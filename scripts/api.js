// 스타일로그 API 서비스

// 리스트 조회용 컬럼 (photos·items 제외 — items 는 상세/작성에서만; 컬럼 없을 때 리스트 400 방지)
const LIST_SELECT = 'id,user_id,date,title,content,weather,weather_temp,weather_temp_min,weather_temp_max,weather_description,weather_fit,thumb_url,tags,is_favorite,created_at,updated_at';

/**
 * style_logs 의 items(jsonb) 배열을 구분(category)별 품목명 Set 맵으로 병합
 * @param {unknown} itemsJson
 * @param {Map<string, Set<string>>} targetMap
 */
function mergeItemsJsonIntoCategoryValueMap(itemsJson, targetMap) {
    let arr = itemsJson;
    if (typeof arr === 'string') {
        try {
            arr = JSON.parse(arr);
        } catch (_) {
            return;
        }
    }
    if (!Array.isArray(arr)) return;

    arr.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        const c = typeof it.category === 'string' ? it.category.trim() : '';
        const v = typeof it.value === 'string' ? it.value.trim() : '';
        if (!c || !v) return;
        if (!targetMap.has(c)) targetMap.set(c, new Set());
        targetMap.get(c).add(v);
    });
}

/** PostgREST / Supabase 오류 전체를 한 문자열로 — message만 보면 놓치는 케이스 방지 */
function flattenPostgrestError(error) {
    if (!error) return '';
    const parts = [];
    if (typeof error.message === 'string') parts.push(error.message);
    if (typeof error.details === 'string') parts.push(error.details);
    if (typeof error.hint === 'string') parts.push(error.hint);
    if (error.code != null) parts.push(String(error.code));
    if (error.status != null) parts.push(String(error.status));
    if (error.statusCode != null) parts.push(String(error.statusCode));
    return parts.join(' ').toLowerCase();
}

/** DB에 style_logs.items 가 없을 때(마이그레이션 전) — 리스트/저장 완화 */
function isStyleLogItemsColumnUnavailable(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const flat = flattenPostgrestError(error);

    // Postgres undefined_column
    if (code === '42703') {
        if (/items/.test(flat)) return true;
        if (/style_logs/.test(flat) && /column/.test(flat)) return true;
    }

    // PostgREST: 스키마 캐시·노출 컬럼 불일치 등 (코드/문구 변형 대비)
    if (code === 'PGRST204') {
        if (/items/.test(flat)) return true;
        if (/could not find/.test(flat) && /column/.test(flat)) return true;
        if (/style_logs/.test(flat) && /column/.test(flat)) return true;
    }

    if (
        /items/.test(flat) &&
        (/does not exist/.test(flat) ||
            /schema cache/.test(flat) ||
            /could not find/.test(flat))
    ) {
        return true;
    }

    if (/schema cache/.test(flat) && /items/.test(flat)) return true;

    return false;
}

/**
 * insert/update 에서 서버 오류 문자열 형태만 달라 isStyleLogItemsColumnUnavailable 에 안 걸릴 때
 * — PATCH/POST 400 이고 내용이 items 컬럼·스키마 불일치로 보이면 items 제외 1회 재시도
 * @param {object} payload
 */
function shouldRetryWithoutItemsField(error, payload) {
    if (
        !error ||
        !payload ||
        typeof payload !== 'object' ||
        !Object.prototype.hasOwnProperty.call(payload, 'items')
    ) {
        return false;
    }
    if (isStyleLogItemsColumnUnavailable(error)) return true;

    const status = Number(error.statusCode ?? error.status);
    const flat = flattenPostgrestError(error);

    /** PostgREST 오류 객체에 HTTP status 가 없는 경우가 있어 NaN 일 때만 본문 키워드로 허용 */
    const okHttpForItemsRetry =
        !Number.isFinite(status) || status === 400;
    if (!okHttpForItemsRetry) return false;

    const mentionsItems = /\bitems\b/.test(flat) || /style_logs\.items/.test(flat);
    if (!mentionsItems) return false;

    return (
        /\bcolumn\b/.test(flat) ||
        /\bfield\b/.test(flat) ||
        /schema\s+cache/.test(flat) ||
        /could\s+not\s+find/.test(flat) ||
        /does\s+not\s+exist/.test(flat) ||
        /\bpgrst204\b/.test(flat)
    );
}

/** items 제외 재시도 직전 — Network 탭 없이도 진단할 수 있도록 서버 오류를 남김 */
function warnStyleLogBeforeOmitItemsRetry(error, actionLabel) {
    console.warn(
        `[StyleLog] ${actionLabel}: 첫 요청이 실패해 items 를 빼고 재시도합니다. ` +
            '아래 code/message 가 컬럼·스키마 관련이면 Supabase 에서 스키마 리로드를 확인하세요.',
        {
            code: error && error.code,
            message: error && error.message,
            details: error && error.details,
            hint: error && error.hint
        }
    );
}

/** sessionStorage 키 — 작성 화면을 다시 열 때도 GET 400 반복 방지(탭 단위) */
const STYLE_LOG_ITEMS_UNAVAILABLE_SS = 'stylelog_style_logs_items_column_unavailable';

function readItemsColumnUnavailableFlag() {
    try {
        return sessionStorage.getItem(STYLE_LOG_ITEMS_UNAVAILABLE_SS) === '1';
    } catch (_) {
        return false;
    }
}

function persistItemsColumnUnavailableFlag() {
    try {
        sessionStorage.setItem(STYLE_LOG_ITEMS_UNAVAILABLE_SS, '1');
    } catch (_) {
        /* private mode 등 */
    }
}

function clearItemsColumnUnavailableFlag() {
    try {
        sessionStorage.removeItem(STYLE_LOG_ITEMS_UNAVAILABLE_SS);
    } catch (_) {
        /* ignore */
    }
}

/**
 * items 컬럼이 API에 보이지 않을 때 동일 브라우저 탭에서 반복되는 GET 400 완화(메모리)
 */
let styleLogItemsSuggestionsQueryDisabled = false;

function omitItemsFromPayload(payload) {
    if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'items')) {
        return { ...payload };
    }
    const { items: _discard, ...rest } = payload;
    return rest;
}

/** 저장 바디에 보낼 만한 착장 품목이 있는지(빈 배열·null 은 아님) */
function payloadHasNontrivialItems(payload) {
    if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'items')) {
        return false;
    }
    const v = payload.items;
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
}

function suggestionsOrStorageSayItemsUnavailable() {
    /*
     * sessionStorage 플래그는 쓰지 않음.
     * 예전 세션에서 "컬럼 없음"으로 찍혀 두면 DB·PostgREST 를 고친 뒤에도
     * 저장 시 items 가 영구히 빠지는 문제가 생김.
     * 같은 탭에서 착장 후보 GET 가 실패한 뒤에만 선제적으로 items 를 빼도록 함.
     */
    return styleLogItemsSuggestionsQueryDisabled;
}

/** write.js 과 동기: items 저장이 살아난 뒤 긴 안내가 다시 필요할 때 초기화 */
const STYLE_LOG_ITEMS_MIGRATION_MODAL_SS = 'stylelog_items_migration_modal_shown';

function clearItemsUnavailableHintsIfOutboundSentItemsPayload(outPayload) {
    if (
        outPayload &&
        typeof outPayload === 'object' &&
        Object.prototype.hasOwnProperty.call(outPayload, 'items')
    ) {
        clearItemsColumnUnavailableFlag();
        styleLogItemsSuggestionsQueryDisabled = false;
        try {
            sessionStorage.removeItem(STYLE_LOG_ITEMS_MIGRATION_MODAL_SS);
        } catch (_) {
            /* ignore */
        }
    }
}

/** API 응답에만 쓰임 — write.js에서 착장 품목 누락 저장 알림용 */
function attachStylelogItemsDroppedMarker(row) {
    if (row && typeof row === 'object') {
        Object.defineProperty(row, '__stylelogItemsDropped', {
            value: true,
            enumerable: false,
            configurable: true
        });
    }
    return row;
}

const StyleLogAPI = {
    // 모든 로그 가져오기 (페이지네이션 지원)
    async getAll(options = {}) {
        try {
            const { 
                limit = 50,  // 기본 50개씩 로드
                offset = 0,  // 시작 위치
                orderBy = 'date',
                ascending = false
            } = options;
            
            let query = supabaseClient
                .from('style_logs')
                .select(LIST_SELECT, { count: 'exact' })
                .order(orderBy, { ascending });
            
            // 페이지네이션 적용
            if (limit) {
                query = query.range(offset, offset + limit - 1);
            }
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            return { data, count };
        } catch (error) {
            console.error('로그 조회 오류:', error);
            throw error;
        }
    },
    
    // 특정 연도의 로그 가져오기 (리스트용 - photos 제외)
    async getByYear(year) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select(LIST_SELECT)
                .gte('date', `${year}-01-01`)
                .lte('date', `${year}-12-31`)
                .order('date', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('연도별 조회 오류:', error);
            throw error;
        }
    },
    
    // 특정 월의 로그 가져오기
    async getByMonth(year, month) {
        try {
            // 숫자로 변환
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            
            const monthStr = String(monthNum).padStart(2, '0');
            const startDate = `${yearNum}-${monthStr}-01`;
            
            // 해당 월의 마지막 날짜 계산 (다음 달 0일 = 이번 달 마지막 날)
            const lastDay = new Date(yearNum, monthNum, 0).getDate();
            const endDate = `${yearNum}-${monthStr}-${lastDay}`;
            
            debugLog('📅 월별 조회:', { year: yearNum, month: monthNum, startDate, endDate });
            
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select(LIST_SELECT)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });
            
            if (error) {
                console.error('❌ Supabase 에러:', error);
                throw error;
            }
            
            debugLog('✅ 조회 성공:', data ? data.length : 0, '개');
            return data || [];
        } catch (error) {
            console.error('월별 조회 오류:', error);
            throw error;
        }
    },
    
    // ID로 특정 로그 가져오기
    async getById(id) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) {
                throw error;
            }
            
            debugLog(`✅ ID ${id} 데이터 조회 성공:`, data);
            return data;
        } catch (error) {
            console.error('ID 조회 오류:', error);
            throw error;
        }
    },
    
    // 특정 날짜의 로그 가져오기
    async getByDate(date) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) {
                throw error;
            }
            
            // 데이터가 없으면 null 반환
            if (!data || data.length === 0) {
                debugLog(`📭 ${date} 날짜에 데이터 없음`);
                return null;
            }
            
            // 첫 번째 데이터 반환 (가장 최근 생성된 것)
            debugLog(`✅ ${date} 데이터 조회 성공:`, data[0]);
            return data[0];
        } catch (error) {
            console.error('날짜별 조회 오류:', error);
            throw error;
        }
    },

    /**
     * 홈·월별 타임라인과 동일한 순서 기준 인접 로그.
     * 정렬 기준: date 내림차순 → created_at 내림차순(같은 날 여러 장이면 늦게 만든 것이 타임라인 위).
     *
     * @param {object} referenceRow 최소 필드 { id, date, created_at }
     * @param {'older'|'newer'} direction older=더 과거 글, newer=더 최근 글
     * @returns {Promise<object|null>} LIST_SELECT 행 또는 없으면 null
     */
    async getAdjacentLog(referenceRow, direction) {
        try {
            if (
                !referenceRow ||
                !referenceRow.date ||
                !referenceRow.created_at ||
                !referenceRow.id
            ) {
                return null;
            }

            const refId = String(referenceRow.id);
            const refDate = referenceRow.date;
            const refCreated = referenceRow.created_at;

            if (direction === 'older') {
                const { data: sameDayOlder, error: errSameOlder } =
                    await supabaseClient
                        .from('style_logs')
                        .select(LIST_SELECT)
                        .eq('date', refDate)
                        .lt('created_at', refCreated)
                        .neq('id', refId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                if (
                    errSameOlder &&
                    errSameOlder.code &&
                    String(errSameOlder.code) !== 'PGRST116'
                ) {
                    throw errSameOlder;
                }
                if (sameDayOlder) return sameDayOlder;

                const { data: priorDay, error: errPrior } = await supabaseClient
                    .from('style_logs')
                    .select(LIST_SELECT)
                    .lt('date', refDate)
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (
                    errPrior &&
                    errPrior.code &&
                    String(errPrior.code) !== 'PGRST116'
                ) {
                    throw errPrior;
                }
                return priorDay || null;
            }

            if (direction === 'newer') {
                const { data: sameDayNewer, error: errSameNewer } =
                    await supabaseClient
                        .from('style_logs')
                        .select(LIST_SELECT)
                        .eq('date', refDate)
                        .gt('created_at', refCreated)
                        .neq('id', refId)
                        .order('created_at', { ascending: true })
                        .limit(1)
                        .maybeSingle();

                if (
                    errSameNewer &&
                    errSameNewer.code &&
                    String(errSameNewer.code) !== 'PGRST116'
                ) {
                    throw errSameNewer;
                }
                if (sameDayNewer) return sameDayNewer;

                const { data: laterDay, error: errLater } = await supabaseClient
                    .from('style_logs')
                    .select(LIST_SELECT)
                    .gt('date', refDate)
                    .order('date', { ascending: true })
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (
                    errLater &&
                    errLater.code &&
                    String(errLater.code) !== 'PGRST116'
                ) {
                    throw errLater;
                }
                return laterDay || null;
            }

            return null;
        } catch (error) {
            console.error('인접 로그 조회 오류:', error);
            throw error;
        }
    },

    // 새 로그 생성
    async create(logData) {
        try {
            // 현재 로그인한 사용자 ID 가져오기
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                throw new Error('로그인이 필요합니다.');
            }

            // 날씨 정보가 없으면 자동으로 가져오기
            if (!logData.weather) {
                const weather = await getCurrentWeather();
                if (weather) {
                    logData.weather = weather.weather;
                    logData.weather_temp = weather.temp;
                    logData.weather_description = weather.description;
                }
            }
            
            // user_id 자동 추가 + (선택) 클라이언트가 지정한 UUID — Storage 경로와 INSERT id 를 맞추기 위함
            const { id: clientRowId, ...logFields } = logData || {};
            const dataWithUserId = {
                ...logFields,
                user_id: user.id
            };
            if (
                typeof clientRowId === 'string' &&
                clientRowId.trim() !== '' &&
                clientRowId !== 'null' &&
                clientRowId !== 'undefined'
            ) {
                dataWithUserId.id = clientRowId.trim();
            }

            debugLog('📝 로그 생성 (user_id 포함):', dataWithUserId);

            const hadNontrivialItems = payloadHasNontrivialItems(dataWithUserId);
            const skipItemsOnWire = suggestionsOrStorageSayItemsUnavailable();
            let outgoing = dataWithUserId;
            if (
                outgoing &&
                Object.prototype.hasOwnProperty.call(outgoing, 'items') &&
                skipItemsOnWire
            ) {
                outgoing = omitItemsFromPayload(outgoing);
            }
            const preemptiveItemsDropped =
                hadNontrivialItems && skipItemsOnWire;

            let { data, error } = await supabaseClient
                .from('style_logs')
                .insert([outgoing])
                .select()
                .single();

            if (!error && preemptiveItemsDropped) {
                debugLog('✅ 로그 생성 완료 (탭 상태상 items 생략, 착장 미저장 가능):', data);
                return attachStylelogItemsDroppedMarker(data);
            }

            if (error && shouldRetryWithoutItemsField(error, dataWithUserId)) {
                persistItemsColumnUnavailableFlag();
                styleLogItemsSuggestionsQueryDisabled = true;
                warnStyleLogBeforeOmitItemsRetry(error, '로그 저장(insert)');
                console.warn(
                    '[StyleLog] DB에 items 컬럼이 없어 착장 품목을 제외하고 저장합니다. docs/supabase/style_logs_add_items.sql 참고.'
                );
                const retryPayload = omitItemsFromPayload(dataWithUserId);
                const r2 = await supabaseClient
                    .from('style_logs')
                    .insert([retryPayload])
                    .select()
                    .single();
                if (r2.error) throw r2.error;
                data = r2.data;
                debugLog('✅ 로그 생성 완료 (items 제외):', data);
                return attachStylelogItemsDroppedMarker(data);
            }

            if (error) throw error;

            clearItemsUnavailableHintsIfOutboundSentItemsPayload(outgoing);
            debugLog('✅ 로그 생성 완료:', data);
            return data;
        } catch (error) {
            console.error('❌ 로그 생성 오류:', error);
            throw error;
        }
    },
    
    // 로그 수정
    async update(id, logData) {
        try {
            const payload = logData;

            const hadNontrivialItems = payloadHasNontrivialItems(payload);
            const skipItemsOnWire = suggestionsOrStorageSayItemsUnavailable();
            let outgoing = payload;
            if (
                outgoing &&
                typeof outgoing === 'object' &&
                Object.prototype.hasOwnProperty.call(outgoing, 'items') &&
                skipItemsOnWire
            ) {
                outgoing = omitItemsFromPayload(outgoing);
            }
            const preemptiveItemsDropped = hadNontrivialItems && skipItemsOnWire;

            let { data, error } = await supabaseClient
                .from('style_logs')
                .update(outgoing)
                .eq('id', id)
                .select()
                .single();

            if (!error && preemptiveItemsDropped) {
                debugLog(
                    '✅ 로그 수정 완료 (탭 상태상 items 생략, 착장 미저장 가능):',
                    data
                );
                return attachStylelogItemsDroppedMarker(data);
            }

            if (error && shouldRetryWithoutItemsField(error, payload)) {
                persistItemsColumnUnavailableFlag();
                styleLogItemsSuggestionsQueryDisabled = true;
                warnStyleLogBeforeOmitItemsRetry(error, '로그 수정(update)');
                console.warn(
                    '[StyleLog] DB에 items 컬럼이 없어 착장 품목 필드를 제외하고 수정합니다. docs/supabase/style_logs_add_items.sql 참고.'
                );
                const retryPayload = omitItemsFromPayload(payload);
                const r2 = await supabaseClient
                    .from('style_logs')
                    .update(retryPayload)
                    .eq('id', id)
                    .select()
                    .single();
                if (r2.error) throw r2.error;
                return attachStylelogItemsDroppedMarker(r2.data);
            }

            if (error) throw error;

            clearItemsUnavailableHintsIfOutboundSentItemsPayload(outgoing);
            return data;
        } catch (error) {
            console.error('로그 수정 오류:', error);
            throw error;
        }
    },
    
    // 로그 삭제
    async delete(id) {
        try {
            const { error } = await supabaseClient
                .from('style_logs')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('로그 삭제 오류:', error);
            throw error;
        }
    },
    
    // 즐겨찾기 토글
    async toggleFavorite(id, isFavorite) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .update({ is_favorite: isFavorite })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('즐겨찾기 토글 오류:', error);
            throw error;
        }
    },
    
    // 월별 로그 개수
    async getMonthCount(year, month) {
        try {
            const monthStr = String(month).padStart(2, '0');
            const startDate = `${year}-${monthStr}-01`;
            const endDate = `${year}-${monthStr}-31`;
            
            const { count, error } = await supabaseClient
                .from('style_logs')
                .select('*', { count: 'exact', head: true })
                .gte('date', startDate)
                .lte('date', endDate);
            
            if (error) throw error;
            return count;
        } catch (error) {
            console.error('개수 조회 오류:', error);
            return 0;
        }
    },
    
    // 태그로 검색 (리스트용 - photos 제외)
    async searchByTag(tag) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select(LIST_SELECT)
                .contains('tags', [tag])
                .order('date', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('태그 검색 오류:', error);
            throw error;
        }
    },
    
    // 텍스트 검색 (리스트용 - photos 제외)
    async search(query) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select(LIST_SELECT)
                .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
                .order('date', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('검색 오류:', error);
            throw error;
        }
    },

    /**
     * 내 기록(items)에서 구분별 품목명 후보 추출 — 작성 화면 autocomplete용
     * @param {{ maxRows?: number, excludeLogId?: string | null }} options
     * @returns {Promise<Map<string, Set<string>>>}
     */
    async getOutfitItemValueSuggestions(options = {}) {
        const maxRows = typeof options.maxRows === 'number' ? options.maxRows : 400;
        const excludeLogId = options.excludeLogId || null;

        const { data: { user }, error: userErr } = await supabaseClient.auth.getUser();
        if (userErr || !user) return new Map();

        if (
            styleLogItemsSuggestionsQueryDisabled ||
            readItemsColumnUnavailableFlag()
        ) {
            return new Map();
        }

        let query = supabaseClient
            .from('style_logs')
            .select('id,items')
            .eq('user_id', user.id)
            .not('items', 'is', null)
            .order('date', { ascending: false })
            .limit(Math.min(Math.max(maxRows, 1), 1000));

        if (excludeLogId) query = query.neq('id', excludeLogId);

        const { data, error } = await query;

        if (error) {
            if (isStyleLogItemsColumnUnavailable(error)) {
                styleLogItemsSuggestionsQueryDisabled = true;
                persistItemsColumnUnavailableFlag();
                if (typeof debugLog === 'function') {
                    debugLog(
                        '착장 품목 DB 컬럼 없음 — 후보만 생략. docs/supabase/style_logs_add_items.sql 실행 필요.',
                        error.message
                    );
                }
                return new Map();
            }
            console.error('착장 품목 후보 로드 오류:', error);
            throw error;
        }

        styleLogItemsSuggestionsQueryDisabled = false;
        clearItemsColumnUnavailableFlag();

        const map = new Map();
        (data || []).forEach((row) => {
            mergeItemsJsonIntoCategoryValueMap(row.items, map);
        });
        return map;
    },

    /**
     * select('*') 등으로 받은 행에 `items` 키가 있으면 API 가 컬럼을 노출하는 것으로 보고,
     * 착장 후보 GET 스킵·PATCH 선제 생략에 쓰이던 오래된 플래그를 지움.
     */
    resetOutfitItemsColumnErrorState() {
        styleLogItemsSuggestionsQueryDisabled = false;
        clearItemsColumnUnavailableFlag();
        try {
            sessionStorage.removeItem(STYLE_LOG_ITEMS_MIGRATION_MODAL_SS);
        } catch (_) {
            /* ignore */
        }
    }
};

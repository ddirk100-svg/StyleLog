// 스타일로그 API 서비스

// 리스트 조회용 컬럼 (photos 제외, thumb_url만 - statement timeout 방지)
const LIST_SELECT = 'id,user_id,date,title,content,weather,weather_temp,weather_temp_min,weather_temp_max,weather_description,weather_fit,thumb_url,tags,is_favorite,created_at,updated_at';

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
            
            console.log('📅 월별 조회:', { year: yearNum, month: monthNum, startDate, endDate });
            
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
            
            console.log('✅ 조회 성공:', data ? data.length : 0, '개');
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
            
            console.log(`✅ ID ${id} 데이터 조회 성공:`, data);
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
                console.log(`📭 ${date} 날짜에 데이터 없음`);
                return null;
            }
            
            // 첫 번째 데이터 반환 (가장 최근 생성된 것)
            console.log(`✅ ${date} 데이터 조회 성공:`, data[0]);
            return data[0];
        } catch (error) {
            console.error('날짜별 조회 오류:', error);
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
            
            // user_id 자동 추가
            const dataWithUserId = {
                ...logData,
                user_id: user.id
            };

            console.log('📝 로그 생성 (user_id 포함):', dataWithUserId);
            
            const { data, error } = await supabaseClient
                .from('style_logs')
                .insert([dataWithUserId])
                .select()
                .single();
            
            if (error) throw error;
            console.log('✅ 로그 생성 완료:', data);
            return data;
        } catch (error) {
            console.error('❌ 로그 생성 오류:', error);
            throw error;
        }
    },
    
    // 로그 수정
    async update(id, logData) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .update(logData)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
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
    }
};

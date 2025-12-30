// 스타일로그 API 서비스

const StyleLogAPI = {
    // 모든 로그 가져오기
    async getAll() {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
                .order('date', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('로그 조회 오류:', error);
            throw error;
        }
    },
    
    // 특정 연도의 로그 가져오기
    async getByYear(year) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
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
                .select('*')
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
    
    // 특정 날짜의 로그 가져오기
    async getByDate(date) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
                .eq('date', date)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    // 데이터 없음 - 에러가 아닌 null 반환
                    console.log(`📭 ${date} 날짜에 데이터 없음`);
                    return null;
                }
                throw error;
            }
            
            console.log(`✅ ${date} 데이터 조회 성공:`, data);
            return data;
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
    
    // 태그로 검색
    async searchByTag(tag) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
                .contains('tags', [tag])
                .order('date', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('태그 검색 오류:', error);
            throw error;
        }
    },
    
    // 텍스트 검색
    async search(query) {
        try {
            const { data, error } = await supabaseClient
                .from('style_logs')
                .select('*')
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

// 날씨 아이콘 SVG 가져오기
function getWeatherIconSVG(weather, size = 48) {
    const icons = {
        sunny: `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <circle cx="24" cy="24" r="6"></circle>
            <path d="M24 4v6M24 38v6M44 24h-6M10 24H4M37.5 10.5l-4.2 4.2M14.7 33.3l-4.2 4.2M37.5 37.5l-4.2-4.2M14.7 14.7l-4.2-4.2"></path>
        </svg>`,
        
        cloudy: `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <path d="M36 24h-1.89A12 12 0 1 0 18 36h18a7.5 7.5 0 0 0 0-15z"></path>
        </svg>`,
        
        rainy: `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <path d="M36 24h-1.89A12 12 0 1 0 18 36h18a7.5 7.5 0 0 0 0-15z"></path>
            <line x1="14" y1="36" x2="14" y2="42"></line>
            <line x1="22" y1="36" x2="22" y2="42"></line>
            <line x1="30" y1="36" x2="30" y2="42"></line>
        </svg>`,
        
        snowy: `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <path d="M36 24h-1.89A12 12 0 1 0 18 36h18a7.5 7.5 0 0 0 0-15z"></path>
            <circle cx="14" cy="40" r="1.5"></circle>
            <circle cx="22" cy="40" r="1.5"></circle>
            <circle cx="30" cy="40" r="1.5"></circle>
        </svg>`,
        
        lightning: `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <polygon points="24 4 12 28 24 28 24 44 36 20 24 20 24 4"></polygon>
        </svg>`,
        
        clear: `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <circle cx="24" cy="24" r="8"></circle>
        </svg>`
    };
    
    return icons[weather] || icons.cloudy;
}


// 인증 관련 유틸리티 함수

// 현재 로그인한 사용자 정보 가져오기
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('❌ 사용자 정보 조회 오류:', error);
        return null;
    }
}

// 현재 세션 확인
async function checkSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        return session;
    } catch (error) {
        console.error('❌ 세션 확인 오류:', error);
        return null;
    }
}

// 로그인 필수 페이지에서 인증 체크
async function requireAuth() {
    const session = await checkSession();
    
    if (!session) {
        console.log('⚠️ 로그인이 필요합니다. 로그인 페이지로 이동합니다.');
        // 현재 페이지 URL을 저장하여 로그인 후 돌아올 수 있도록
        const currentPage = window.location.pathname + window.location.search;
        sessionStorage.setItem('redirectAfterLogin', currentPage);
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// 로그아웃
async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        console.log('✅ 로그아웃 성공');
        window.location.href = 'landing.html';
    } catch (error) {
        console.error('❌ 로그아웃 오류:', error);
        if (typeof showAlert === 'function') showAlert('로그아웃에 실패했습니다.');
        else alert('로그아웃에 실패했습니다.');
    }
}

// 로그인 후 리다이렉트
function redirectAfterLogin() {
    const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
    sessionStorage.removeItem('redirectAfterLogin');
    
    if (redirectUrl && redirectUrl !== '/login.html' && redirectUrl !== '/signup.html') {
        window.location.href = redirectUrl;
    } else {
        window.location.href = 'home.html';
    }
}

// 인증 상태 변경 감지
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔐 인증 상태 변경:', event, session);
    
    if (event === 'SIGNED_IN') {
        console.log('✅ 로그인됨');
    } else if (event === 'SIGNED_OUT') {
        console.log('🚪 로그아웃됨');
    } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 토큰 갱신됨');
    }
});


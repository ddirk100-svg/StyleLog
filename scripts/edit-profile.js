// 내 정보 수정 스크립트

async function initPage() {
    await loadUserInfo();
    attachEventListeners();
}

async function loadUserInfo() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'mypage.html';
        return;
    }

    document.getElementById('email').value = user.email || '';
    document.getElementById('displayName').value = user.user_metadata?.full_name || user.user_metadata?.name || '';
}

function attachEventListeners() {
    document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = document.getElementById('displayName').value.trim();
        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { full_name: displayName }
            });
            if (error) throw error;
            alert('저장되었습니다.');
            window.location.href = 'mypage.html';
        } catch (error) {
            console.error('업데이트 오류:', error);
            alert('저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
        }
    });
}

// 문의 작성 → Supabase support_inquiries

function initPage() {
    attachEventListeners();
}

function attachEventListeners() {
    const form = document.getElementById('inquiryForm');
    const titleInput = document.getElementById('inquiryTitle');
    const contentInput = document.getElementById('inquiryContent');
    const saveBtn = document.querySelector('.save-btn');

    const validateForm = () => {
        const hasTitle = titleInput?.value.trim().length > 0;
        const hasContent = contentInput?.value.trim().length > 0;
        if (saveBtn) saveBtn.disabled = !(hasTitle && hasContent);
    };

    titleInput?.addEventListener('input', validateForm);
    contentInput?.addEventListener('input', validateForm);
    validateForm();

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput?.value.trim();
        const body = contentInput?.value.trim();
        if (!title || !body) return;

        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            await showAlert('연결 설정을 확인해 주세요.');
            return;
        }

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            await showAlert('로그인이 필요합니다.');
            return;
        }

        if (saveBtn) saveBtn.disabled = true;

        const { error } = await supabaseClient.from('support_inquiries').insert({
            user_id: user.id,
            title,
            body,
            status: 'open'
        });

        if (error) {
            console.error(error);
            if (saveBtn) saveBtn.disabled = false;
            await showAlert(getInquiryWriteErrorMessage(error));
            return;
        }

        await showAlert('문의가 등록되었습니다.');
        window.location.href = 'inquiry.html';
    });
}

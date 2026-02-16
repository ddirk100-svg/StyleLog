// 문의 작성 스크립트
// 추후: 문의 등록 API 연동

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

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        // 추후: 문의 등록 API 연동
        alert('문의 작성 기능은 추후 연동됩니다.');
    });
}

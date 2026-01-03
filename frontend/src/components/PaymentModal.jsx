import { useState } from 'react';
import { Button, Spacing } from '@toss/tds-mobile';
import './PaymentModal.css';

// 상품 ID (콘솔에서 등록한 값)
const PRODUCT_ID = 'ait.0000015595.2522bade.4f8d898420.7421896636';

export function PaymentModal({ onClose, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // @apps-in-toss/web-framework에서 IAP 동적 import
      const { IAP } = await import('@apps-in-toss/web-framework');
      
      console.log('💳 결제 시작:', PRODUCT_ID);
      
      // 일회성 상품 구매 요청
      const result = await IAP.createOneTimePurchaseOrder({
        productId: PRODUCT_ID,
      });
      
      console.log('💳 결제 결과:', result);
      
      // 결제 성공 시 백엔드에서 슬롯 증가 처리
      onSuccess();
      
    } catch (err) {
      console.error('💳 결제 실패:', err);
      
      // 사용자가 취소한 경우
      if (err?.code === 'USER_CANCELLED' || err?.message?.includes('cancel')) {
        console.log('💳 사용자가 결제를 취소했습니다');
        // 취소는 에러 메시지 표시 안 함
        return;
      }
      
      // 기타 오류
      setError('결제에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 개발 환경 테스트용 (토스 앱 외부에서 실행 시)
  const handleDevPurchase = async () => {
    setIsProcessing(true);
    console.log('💳 [개발 환경] 결제 시뮬레이션');
    
    // 시뮬레이션 딜레이
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsProcessing(false);
    onSuccess();
  };

  // 토스 앱 환경인지 확인
  const isInTossApp = typeof window !== 'undefined' && 
    (window.__GRANITE_ENV__ || window.appsInToss);

  return (
    <>
      <div className="payment-modal-overlay show" onClick={onClose} />
      <div className="payment-modal-container show" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <h3 className="payment-modal-title">결제하기</h3>
          <p className="payment-modal-description">
            소중한 인연을 놓치지 않도록,<br />
            알람 슬롯을 하나 더 추가해보세요.<br />
            구매한 슬롯은 영구적으로 누적돼요.
          </p>
        </div>
        
        {error && (
          <p className="payment-modal-error">{error}</p>
        )}
        
        <div className="payment-modal-cta">
          <Button
            size="large"
            display="block"
            onClick={isInTossApp ? handlePurchase : handleDevPurchase}
            disabled={isProcessing}
            loading={isProcessing}
          >
            알람 슬롯 추가하기 (990원)
          </Button>
          <Spacing size={8} />
          <Button
            size="large"
            display="block"
            color="dark"
            variant="weak"
            onClick={onClose}
            disabled={isProcessing}
            style={{
              '--button-background-color': '#f2f4f6',
              '--button-color': '#6b7684',
            }}
          >
            나중에 하기
          </Button>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Button, Spacing } from '@toss/tds-mobile';
import './PaymentModal.css';

// 상품 SKU (콘솔에서 등록한 값)
const PRODUCT_SKU = 'ait.0000015595.2522bade.4f8d898420.7421896636';

export function PaymentModal({ onClose, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const iapModuleRef = useRef(null);

  // 컴포넌트 마운트 시 IAP 모듈 사전 로드
  useEffect(() => {
    const preloadIAP = async () => {
      try {
        const { IAP } = await import('@apps-in-toss/web-framework');
        iapModuleRef.current = IAP;
      } catch (e) {
        // 로드 실패 시 무시
      }
    };
    preloadIAP();
  }, []);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // IAP 모듈 가져오기
      let IAP = iapModuleRef.current;
      if (!IAP) {
        const module = await import('@apps-in-toss/web-framework');
        IAP = module.IAP;
      }
      
      // SDK 지원 여부 확인
      if (!IAP || typeof IAP.createOneTimePurchaseOrder !== 'function') {
        setError('이 환경에서는 결제를 지원하지 않아요.');
        setIsProcessing(false);
        return;
      }
      
      // 결제 요청 (SDK 1.1.3+ 콜백 방식)
      // 참고: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/인앱%20결제/IAP.html
      const cleanup = IAP.createOneTimePurchaseOrder({
        options: {
          sku: PRODUCT_SKU,
          processProductGrant: ({ orderId }) => {
            // 상품 지급 로직 - 서버에서 슬롯 증가 처리
            // 여기서는 true를 반환하고, onSuccess에서 실제 처리
            return true;
          }
        },
        onEvent: (event) => {
          if (event.type === 'success') {
            cleanup?.();
            onSuccess();
          }
        },
        onError: (error) => {
          cleanup?.();
          
          // 사용자가 취소한 경우 - 조용히 닫기
          if (error?.code === 'USER_CANCELLED' || 
              error?.message?.includes('cancel') || 
              error?.message?.includes('취소')) {
            setIsProcessing(false);
            return;
          }
          
          // 기타 오류
          setError('결제에 실패했어요. 다시 시도해주세요.');
          setIsProcessing(false);
        },
      });
      
    } catch (err) {
      // 사용자가 취소한 경우 - 조용히 닫기
      if (err?.code === 'USER_CANCELLED' || 
          err?.message?.includes('cancel') || 
          err?.message?.includes('취소')) {
        setIsProcessing(false);
        return;
      }
      
      // 기타 오류
      setError('결제에 실패했어요. 다시 시도해주세요.');
      setIsProcessing(false);
    }
  };

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
            onClick={handlePurchase}
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

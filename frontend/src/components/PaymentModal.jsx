import { useState, useEffect, useRef } from 'react';
import { Button, Spacing } from '@toss/tds-mobile';
import './PaymentModal.css';

// 상품 ID (콘솔에서 등록한 값)
const PRODUCT_ID = 'ait.0000015595.2522bade.4f8d898420.7421896636';

// 최소 로딩 시간 (깜빡임 방지)
const MIN_LOADING_TIME = 1500;

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
    
    const startTime = Date.now();
    
    // 최소 로딩 시간 보장 함수
    const ensureMinLoadTime = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }
    };
    
    try {
      // IAP 모듈 가져오기 (사전 로드되었으면 캐시 사용)
      let IAP = iapModuleRef.current;
      if (!IAP) {
        const module = await import('@apps-in-toss/web-framework');
        IAP = module.IAP;
      }
      
      // IAP SDK 지원 여부 확인
      if (!IAP || typeof IAP.createOneTimePurchaseOrder !== 'function') {
        await ensureMinLoadTime();
        setError('이 환경에서는 결제를 지원하지 않아요.');
        setIsProcessing(false);
        return;
      }
      
      // 일회성 상품 구매 요청
      const result = await IAP.createOneTimePurchaseOrder({
        productId: PRODUCT_ID,
      });
      
      await ensureMinLoadTime();
      
      // 결제 성공
      onSuccess();
      
    } catch (err) {
      await ensureMinLoadTime();
      
      // 사용자가 취소한 경우 - 조용히 닫기
      if (err?.code === 'USER_CANCELLED' || 
          err?.message?.includes('cancel') || 
          err?.message?.includes('취소')) {
        setIsProcessing(false);
        return;
      }
      
      // 기타 오류
      setError('결제에 실패했어요. 다시 시도해주세요.');
    } finally {
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

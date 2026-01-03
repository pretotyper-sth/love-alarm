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
      // Step 1: IAP 모듈 가져오기
      let IAP = iapModuleRef.current;
      if (!IAP) {
        const module = await import('@apps-in-toss/web-framework');
        IAP = module.IAP;
      }
      
      // Step 2: SDK 지원 여부 확인
      if (!IAP || typeof IAP.createOneTimePurchaseOrder !== 'function') {
        await ensureMinLoadTime();
        setError('이 환경에서는 결제를 지원하지 않아요.');
        setIsProcessing(false);
        return;
      }
      
      // Step 3: 상품 목록 조회 (샌드박스에서는 mock 상품 반환)
      let productIdToUse = PRODUCT_ID;
      
      if (typeof IAP.getProductItemList === 'function') {
        try {
          const products = await IAP.getProductItemList();
          alert(`[DEBUG] 상품 목록:\n${JSON.stringify(products, null, 2)}`);
          
          // 상품이 있으면 첫 번째 상품 사용 (샌드박스 mock 상품)
          if (products && products.length > 0) {
            // 실제 상품 ID가 있으면 사용, 없으면 첫 번째 mock 상품 사용
            const realProduct = products.find(p => p.productId === PRODUCT_ID || p.sku === PRODUCT_ID);
            if (realProduct) {
              productIdToUse = realProduct.productId || realProduct.sku;
            } else {
              // 샌드박스: mock 상품 사용
              productIdToUse = products[0].productId || products[0].sku;
              alert(`[INFO] 샌드박스 mock 상품 사용: ${productIdToUse}`);
            }
          }
        } catch (listErr) {
          alert(`[WARN] 상품 목록 조회 실패: ${listErr.message}\n실제 상품 ID로 시도합니다.`);
        }
      }
      
      // Step 4: 결제 요청
      alert(`[DEBUG] 결제 요청\n상품 ID: ${productIdToUse}`);
      const result = await IAP.createOneTimePurchaseOrder({
        productId: productIdToUse,
      });
      
      alert(`[SUCCESS] 결제 완료!\n${JSON.stringify(result, null, 2)}`);
      
      await ensureMinLoadTime();
      
      // 결제 성공
      onSuccess();
      
    } catch (err) {
      // 상세 에러 로그
      alert(`[ERROR] 결제 실패!\n\n코드: ${err?.code || 'N/A'}\n메시지: ${err?.message || err}`);
      
      await ensureMinLoadTime();
      
      // 사용자가 취소한 경우 - 조용히 닫기
      if (err?.code === 'USER_CANCELLED' || 
          err?.message?.includes('cancel') || 
          err?.message?.includes('취소')) {
        setIsProcessing(false);
        return;
      }
      
      // 기타 오류
      setError(`결제 실패: ${err?.message || '알 수 없는 오류'}`);
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

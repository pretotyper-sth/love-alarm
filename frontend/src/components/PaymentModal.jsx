import { useState, useEffect } from 'react';
import { Button, Modal } from '@toss/tds-mobile';
import './PaymentModal.css';

export function PaymentModal({ onClose, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
      // @apps-in-toss/web-framework의 IAP API 사용
      // 실제 구현 시 콘솔에 등록된 상품 ID를 사용해야 합니다
      // 웹 프레임워크에서는 window.appsInToss를 통해 접근
      if (typeof window !== 'undefined' && window.appsInToss?.IAP) {
        await window.appsInToss.IAP.createOneTimePurchaseOrder({
          productId: 'alarm_slot_1000', // 콘솔에 등록된 상품 ID로 변경 필요
        });
        onSuccess();
      } else {
        // 개발 환경에서는 바로 성공 처리
        console.log('결제 시뮬레이션 (개발 환경)');
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
    } catch (error) {
      console.error('결제 실패:', error);
      alert('결제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose}>
      <div className="payment-modal">
        <h2 className="payment-title">결제하기</h2>
        <p className="payment-description">
          소중한 인연을 놓치지 않도록, 알람 슬롯을 하나 더 추가해보세요. 구매한 슬롯은 영구적으로 누적돼요.
        </p>
        <div className="payment-actions">
          <Button
            onClick={handlePurchase}
            disabled={isProcessing}
            className="purchase-button"
          >
            알람 슬롯 추가하기 (1,000원)
          </Button>
          <Button
            onClick={onClose}
            className="cancel-button"
          >
            나중에 하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}


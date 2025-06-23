import React from 'react'
import { ImageResponse } from 'next/og'

// Image metadata
export const alt = 'VEO Dashboard 관리자 대시보드'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e293b',
          backgroundImage: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#f59e0b',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '24px',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                color: '#ffffff',
              }}
            >
              ⚙️
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#ffffff',
                lineHeight: '1.1',
                letterSpacing: '-0.02em',
              }}
            >
              관리자 대시보드
            </div>
            <div
              style={{
                fontSize: '20px',
                color: '#f59e0b',
                marginTop: '8px',
                letterSpacing: '0.025em',
              }}
            >
              VEO Dashboard Admin Panel
            </div>
          </div>
        </div>
        
        <div
          style={{
            fontSize: '18px',
            color: '#cbd5e1',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: '1.4',
            marginBottom: '32px',
          }}
        >
          시스템 관리 및 비디오 동기화 상태를 확인하고 관리할 수 있는 관리자 전용 페이지
        </div>
        
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🔧</span>
            시스템 관리
          </div>
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              border: '2px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📊</span>
            상태 모니터링
          </div>
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              border: '2px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🔄</span>
            동기화 관리
          </div>
        </div>
        
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '8px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          🔒 ADMIN ONLY
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
} 
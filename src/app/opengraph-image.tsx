import React from 'react'
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Image metadata - 권장 OG 이미지 사이즈: 1200x630
export const alt = 'VEO 대시보드 - AI 비디오 생성 플랫폼'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Image generation
export default async function Image() {
  let roseImageSrc = ''
  
  try {
    // Load the rose image from public folder
    const roseImageData = await readFile(join(process.cwd(), 'public/one_rose.jpg'))
    roseImageSrc = `data:image/jpeg;base64,${roseImageData.toString('base64')}`
  } catch (error) {
    console.error('Failed to load rose image:', error)
    // Fallback: 이미지 로드 실패 시 기본 배경색 사용
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: roseImageSrc ? 'transparent' : '#1a1a1a',
        }}
      >
        {/* Background rose image */}
        {roseImageSrc && (
          <img
            src={roseImageSrc}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        
        {/* Overlay with gradient */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: roseImageSrc 
              ? 'linear-gradient(45deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%)'
              : 'linear-gradient(45deg, #2d1b69 0%, #11998e 100%)',
          }}
        />
        
        {/* Content overlay */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            textAlign: 'center',
            padding: '50px 40px',
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              marginBottom: '16px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              letterSpacing: '-0.02em',
            }}
          >
            VEO 대시보드
          </div>
          
          <div
            style={{
              fontSize: '28px',
              marginBottom: '20px',
              textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
              color: '#f0f0f0',
            }}
          >
            AI 비디오 생성 플랫폼
          </div>
          
          <div
            style={{
              fontSize: '18px',
              maxWidth: '700px',
              lineHeight: '1.4',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              color: '#e0e0e0',
              marginBottom: '24px',
            }}
          >
            구글의 VEO AI 모델로 비디오 콘텐츠를 생성해보세요
          </div>
          
          <div
            style={{
              display: 'flex',
              gap: '12px',
            }}
          >
            <div
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: '#333333',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              }}
            >
              🎬 비디오 생성
            </div>
            <div
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: '#ffffff',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              }}
            >
              🚀 AI 기반
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
} 
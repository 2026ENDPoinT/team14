// 꽁꽁 언 펫(7일 이상 미접속)에 쓸 그림을 펫 그림에서 계산해 만든다 (캔버스, 브라우저 안에서만)
// - 얼음: 펫 테두리를 바깥으로 두껍게 부풀린 모양 + 하늘색 + 각진 밝은 면 + 테두리 선
// - 피부색: 입 둘레에서 가장 밝은 불투명 색 (웃는 입을 덮을 색)
// 같은 그림은 한 번만 계산한다 (캐시)
const cache = new Map()

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// 그림 모양을 사방(dirs 방향)으로 r만큼 밀어 겹쳐 그려서 부풀린 실루엣을 만든다
function dilate(ctx, img, pad, r, dirs) {
  for (let i = 0; i < dirs; i++) {
    const a = (i / dirs) * Math.PI * 2
    ctx.drawImage(img, pad + Math.cos(a) * r, pad + Math.sin(a) * r)
  }
  ctx.drawImage(img, pad, pad)
}

function makeIce(img) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const pad = Math.round(Math.max(w, h) * 0.07)
  const width = w + pad * 2
  const height = h + pad * 2

  // 테두리 선: 조금 더 부풀린 모양에서 얼음 안쪽을 뺀 고리
  const edge = document.createElement('canvas')
  edge.width = width
  edge.height = height
  const ectx = edge.getContext('2d')
  dilate(ectx, img, pad, pad, 10)
  ectx.globalCompositeOperation = 'source-in'
  ectx.fillStyle = 'rgba(110, 165, 210, 0.85)'
  ectx.fillRect(0, 0, width, height)
  ectx.globalCompositeOperation = 'destination-out'
  dilate(ectx, img, pad, pad - Math.max(2, pad * 0.12), 10)

  // 얼음 본체: 위는 밝고 아래로 조금 진한 하늘색
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  dilate(ctx, img, pad, pad, 10)
  ctx.globalCompositeOperation = 'source-in'
  const g = ctx.createLinearGradient(0, 0, 0, height)
  g.addColorStop(0, 'rgba(232, 246, 255, 0.5)')
  g.addColorStop(0.55, 'rgba(192, 226, 248, 0.42)')
  g.addColorStop(1, 'rgba(160, 206, 240, 0.55)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)

  // 각진 면: 비스듬한 밝은·어두운 면 (얼음 안쪽에만)
  ctx.globalCompositeOperation = 'source-atop'
  const face = (color, points) => {
    ctx.fillStyle = color
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height)))
    ctx.fill()
  }
  face('rgba(255, 255, 255, 0.28)', [[0, 0.1], [0.45, 0], [0.62, 0], [0, 0.42]])
  face('rgba(255, 255, 255, 0.16)', [[1, 0.55], [0.7, 1], [1, 1]])
  face('rgba(90, 150, 200, 0.12)', [[0.55, 1], [1, 0.3], [1, 1]])
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(edge, 0, 0)
  return { iceUrl: c.toDataURL(), padX: pad / w, padY: pad / h }
}

// 입 둘레에서 가장 밝은 불투명 색 = 피부색 (볼터치는 더 어둡고, 이빨·혀는 입 안쪽이라 피한다)
function skinNear(img, [mx, my, mw]) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const cx = mx * c.width
  const cy = my * c.height
  const r = mw * c.width * 1.05
  let best = null
  let bestL = -1
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const [R, G, B, A] = ctx.getImageData(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 1, 1).data
    const L = R * 0.3 + G * 0.59 + B * 0.11
    if (A > 230 && L > bestL) {
      bestL = L
      best = `rgb(${R}, ${G}, ${B})`
    }
  }
  return best
}

// 결과: { iceUrl, padX, padY, skin, aspect } (만들지 못하면 null)
export function getFrozenArt(src, mouth) {
  const key = `${src}|${mouth.join(',')}`
  if (!cache.has(key)) {
    cache.set(
      key,
      loadImage(src)
        .then((img) => ({ ...makeIce(img), skin: mouth[3] ? skinNear(img, mouth) : null, aspect: img.naturalWidth / img.naturalHeight }))
        .catch(() => null),
    )
  }
  return cache.get(key)
}

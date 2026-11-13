import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// 펫 이미지 + 부분 애니메이션 (눈 깜빡임·손 흔들기)
// - frames: petFrames() 결과. 프레임이 없으면 원본 PNG 한 장만 보여 준다 (지금과 똑같음)
// - 같은 <img>의 그림만 잠깐 바꾼다 → 위치·크기가 흔들리지 않는다
// - 프레임은 원본과 크기가 같을 때만 쓴다 (미리 불러와 확인)
// - 움직임 줄이기 설정이면 자동 깜빡임·손 흔들기를 하지 않는다
// - ref.react(): 클릭·터치 반응 (손 흔들기 프레임이 있으면 짧게 흔들고, 없으면 눈 깜빡임)
const BLINK_MS = 130 // 눈 감고 있는 시간
const BLINK_EVERY = [4000, 7000] // 깜빡임 간격 (무작위)
const WAVE_EVERY = [12000, 20000] // 손 흔들기 간격 (무작위)
const WAVE_FRAME_MS = 150 // 손 흔들기 한 장면 시간
const between = ([min, max]) => min + Math.random() * (max - min)
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// 원본과 같은 크기인 프레임만 남긴다 (불러오기 실패·크기 다름 → 제외)
function loadSize(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

const PetSprite = forwardRef(function PetSprite({ src, frames, alt }, ref) {
  const [shown, setShown] = useState(null) // 지금 보여 주는 프레임 (null = 원본)
  const [ready, setReady] = useState({ blink: null, wave: [] })
  const busy = useRef(false)
  const timers = useRef([])

  // 프레임 미리 불러오기·크기 확인 (원본이 바뀌면 다시)
  useEffect(() => {
    let alive = true
    setReady({ blink: null, wave: [] })
    setShown(null)
    const list = [frames.blink, ...frames.wave].filter(Boolean)
    if (!src || list.length === 0) return undefined
    Promise.all([loadSize(src), ...list.map(loadSize)]).then(([base, ...sizes]) => {
      if (!alive || !base) return
      const same = (i) => sizes[i] && sizes[i].w === base.w && sizes[i].h === base.h
      const blinkOk = frames.blink && same(0)
      const offset = frames.blink ? 1 : 0
      const waveOk = frames.wave.length >= 2 && frames.wave.every((_, i) => same(offset + i))
      setReady({ blink: blinkOk ? frames.blink : null, wave: waveOk ? frames.wave : [] })
    })
    return () => {
      alive = false
    }
  }, [src, frames])

  // 장면 순서대로 보여 주기: [[url, ms], …] → 끝나면 원본
  const play = (steps) => {
    if (busy.current || steps.length === 0) return
    busy.current = true
    let t = 0
    for (const [url, ms] of steps) {
      timers.current.push(setTimeout(() => setShown(url), t))
      t += ms
    }
    timers.current.push(setTimeout(() => {
      setShown(null)
      busy.current = false
    }, t))
  }
  const blink = () => ready.blink && play([[ready.blink, BLINK_MS]])
  const wave = (times) => {
    if (ready.wave.length === 0) return
    const steps = []
    for (let k = 0; k < times; k += 1) for (const url of ready.wave) steps.push([url, WAVE_FRAME_MS])
    play(steps)
  }

  useImperativeHandle(ref, () => ({
    react() {
      if (reducedMotion()) return
      if (ready.wave.length) wave(2)
      else blink()
    },
  }))

  // 자동: 4~7초마다 깜빡임, 12~20초마다 손 2~3번 흔들기
  useEffect(() => {
    if (reducedMotion() || (!ready.blink && ready.wave.length === 0)) return undefined
    let alive = true
    const loop = (every, act) => {
      const id = setTimeout(() => {
        if (!alive) return
        if (!document.hidden) act()
        loop(every, act)
      }, between(every))
      timers.current.push(id)
    }
    if (ready.blink) loop(BLINK_EVERY, blink)
    if (ready.wave.length) loop(WAVE_EVERY, () => wave(Math.random() < 0.5 ? 2 : 3))
    return () => {
      alive = false
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // 화면을 떠나면 예약된 장면을 모두 지운다
  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  return <img key={src} className="hm-pet__img" src={shown ?? src} alt={alt} draggable="false" data-frame={shown ? 'on' : 'off'} />
})

export default PetSprite

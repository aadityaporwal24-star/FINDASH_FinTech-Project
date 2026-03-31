import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const facialExpressions = {
  default: {},
  smile: {
    browInnerUp: 0.17,
    eyeSquintLeft: 0.35,
    eyeSquintRight: 0.35,
    mouthSmileLeft: 0.32,
    mouthSmileRight: 0.32,
  },
  sad: {
    mouthFrownLeft: 0.75,
    mouthFrownRight: 0.75,
    browInnerUp: 0.4,
  },
  surprised: {
    eyeWideLeft: 0.5,
    eyeWideRight: 0.5,
    jawOpen: 0.28,
    browInnerUp: 0.7,
  },
  angry: {
    browDownLeft: 0.85,
    browDownRight: 0.85,
    eyeSquintLeft: 0.9,
    eyeSquintRight: 0.9,
  },
}

function inferExpressionFromText(text) {
  const value = String(text || '').toLowerCase()
  if (/risk|default|warning|non[- ]?compliance|high/i.test(value)) return 'angry'
  if (/loss|decline|miss|concern|drop/i.test(value)) return 'sad'
  if (/opportunity|approval|improve|good|strong/i.test(value)) return 'smile'
  if (/surprise|unexpected|sudden/i.test(value)) return 'surprised'
  return 'default'
}

export function AgentAvatar({ latestAssistantText, speaking }) {
  const { nodes, materials, scene } = useGLTF('/models/64f1a714fe61576b46f27ca2.glb')
  const { animations } = useGLTF('/models/animations.glb')
  const group = useRef(null)
  const { actions, mixer } = useAnimations(animations, group)
  const [animation, setAnimation] = useState('Idle')
  const [blink, setBlink] = useState(false)
  const expression = useMemo(() => inferExpressionFromText(latestAssistantText), [latestAssistantText])

  useEffect(() => {
    const desired = speaking ? 'Talking_1' : 'Idle'
    const available = animations.find((a) => a.name === desired)?.name || animations[0]?.name
    if (available) setAnimation(available)
  }, [speaking, animations])

  useEffect(() => {
    const action = actions?.[animation]
    if (!action) return
    action.reset().fadeIn(mixer.stats.actions.inUse === 0 ? 0 : 0.35).play()
    return () => action.fadeOut(0.35)
  }, [actions, animation, mixer])

  useEffect(() => {
    let timer
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true)
        setTimeout(() => {
          setBlink(false)
          loop()
        }, 170)
      }, THREE.MathUtils.randInt(1200, 4200))
    }
    loop()
    return () => clearTimeout(timer)
  }, [])

  useFrame(() => {
    const mapping = facialExpressions[expression] || facialExpressions.default
    scene.traverse((child) => {
      if (!child?.isSkinnedMesh || !child?.morphTargetDictionary || !child?.morphTargetInfluences) return
      Object.entries(child.morphTargetDictionary).forEach(([key, idx]) => {
        if (idx == null || child.morphTargetInfluences[idx] == null) return
        const isBlinkKey = key === 'eyeBlinkLeft' || key === 'eyeBlinkRight'
        const target = isBlinkKey ? (blink ? 1 : 0) : Number(mapping[key] || 0)
        child.morphTargetInfluences[idx] = THREE.MathUtils.lerp(child.morphTargetInfluences[idx], target, isBlinkKey ? 0.45 : 0.14)
      })
    })
  })

  return (
    <group dispose={null} ref={group}>
      <primitive object={nodes.Hips} />
      <skinnedMesh geometry={nodes.Wolf3D_Body.geometry} material={materials.Wolf3D_Body} skeleton={nodes.Wolf3D_Body.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Bottom.geometry} material={materials.Wolf3D_Outfit_Bottom} skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Footwear.geometry} material={materials.Wolf3D_Outfit_Footwear} skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Top.geometry} material={materials.Wolf3D_Outfit_Top} skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Hair.geometry} material={materials.Wolf3D_Hair} skeleton={nodes.Wolf3D_Hair.skeleton} />
      <skinnedMesh geometry={nodes.EyeLeft.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeLeft.skeleton} morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary} morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences} />
      <skinnedMesh geometry={nodes.EyeRight.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeRight.skeleton} morphTargetDictionary={nodes.EyeRight.morphTargetDictionary} morphTargetInfluences={nodes.EyeRight.morphTargetInfluences} />
      <skinnedMesh geometry={nodes.Wolf3D_Head.geometry} material={materials.Wolf3D_Skin} skeleton={nodes.Wolf3D_Head.skeleton} morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences} />
      <skinnedMesh geometry={nodes.Wolf3D_Teeth.geometry} material={materials.Wolf3D_Teeth} skeleton={nodes.Wolf3D_Teeth.skeleton} morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences} />
    </group>
  )
}

useGLTF.preload('/models/64f1a714fe61576b46f27ca2.glb')
useGLTF.preload('/models/animations.glb')

import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  ConnectionStateType,
  createAgoraRtcEngine,
  QualityType,
  RtcSurfaceView,
  StreamFallbackOptions,
  type IRtcEngine,
  type IRtcEngineEventHandler,
} from 'react-native-agora';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { getCallPass, type CallPass } from '@/lib/call';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Phase = 'preparing' | 'waiting' | 'connected' | 'reconnecting' | 'ended' | 'error';

/**
 * A private video or audio call for one paid visit. Only the visit's patient and doctor can join:
 * the server checks that before giving out the call pass. Nothing is recorded.
 */
export default function CallScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const engine = useRef<IRtcEngine | null>(null);
  const handler = useRef<IRtcEngineEventHandler | null>(null);
  const [pass, setPass] = useState<CallPass | null>(null);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [message, setMessage] = useState<string | null>(null);
  const [otherHere, setOtherHere] = useState(false);
  const [otherVideoOff, setOtherVideoOff] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [weak, setWeak] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const video = pass?.mode === 'video';
  const otherName = pass?.role === 'patient' ? 'the doctor' : 'the patient';

  const leave = useCallback(() => {
    const e = engine.current;
    engine.current = null;
    if (e) {
      try {
        e.leaveChannel();
        if (handler.current) e.unregisterEventHandler(handler.current);
        e.release();
      } catch {
        // The call is over either way.
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'android') {
        const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA];
        const got = await PermissionsAndroid.requestMultiple(wanted);
        if (got[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
          setPhase('error');
          setMessage('Landu needs the microphone for calls. Allow it in your phone settings, then try again.');
          return;
        }
      }
      const { pass: p, error } = await getCallPass(String(id));
      if (cancelled) return;
      if (!p) {
        setPhase('error');
        setMessage(error ?? 'Could not start the call.');
        return;
      }
      setPass(p);

      const e = createAgoraRtcEngine();
      engine.current = e;
      e.initialize({ appId: p.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
      const h: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => setPhase('waiting'),
        onUserJoined: (_c, uid) => {
          if (uid === p.otherUid) {
            setOtherHere(true);
            setPhase('connected');
          }
        },
        onUserOffline: (_c, uid) => {
          if (uid === p.otherUid) {
            setOtherHere(false);
            setPhase('waiting');
          }
        },
        onUserMuteVideo: (_c, uid, off) => {
          if (uid === p.otherUid) setOtherVideoOff(off);
        },
        onConnectionStateChanged: (_c, state) => {
          if (state === ConnectionStateType.ConnectionStateReconnecting) setPhase('reconnecting');
          if (state === ConnectionStateType.ConnectionStateConnected) setPhase((ph) => (ph === 'reconnecting' ? 'waiting' : ph));
          if (state === ConnectionStateType.ConnectionStateFailed) {
            setPhase('error');
            setMessage('The call could not connect. Check your network and try again.');
          }
        },
        onNetworkQuality: (_c, uid, tx, rx) => {
          if (uid === 0) setWeak(Math.max(tx, rx) >= QualityType.QualityBad);
        },
        // Fetch a fresh pass before the old one runs out, so long visits are not cut off.
        onTokenPrivilegeWillExpire: async () => {
          const next = await getCallPass(String(id));
          if (next.pass) engine.current?.renewToken(next.pass.token);
        },
      };
      handler.current = h;
      e.registerEventHandler(h);

      if (p.mode === 'video') {
        e.enableVideo();
        // Modest quality suits rural networks; video drops to audio-only when the line is poor.
        e.setVideoEncoderConfiguration({ dimensions: { width: 640, height: 360 }, frameRate: 15, bitrate: 0 });
        e.enableDualStreamMode(true);
        e.setRemoteSubscribeFallbackOption(StreamFallbackOptions.StreamFallbackOptionAudioOnly);
        e.startPreview();
      } else {
        e.disableVideo();
      }
      e.setDefaultAudioRouteToSpeakerphone(p.mode === 'video');
      setSpeaker(p.mode === 'video');
      e.joinChannel(p.token, p.channel, p.uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: p.mode === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: p.mode === 'video',
      });

      // The doctor joining starts the visit, so notes and prescriptions can be written.
      if (p.role === 'doctor') {
        await supabase.rpc('doctor_update_visit', { p_appointment: String(id), p_status: 'in_progress' });
      }
    })();
    return () => {
      cancelled = true;
      leave();
    };
  }, [id, leave]);

  // Call length, counted while both people are in.
  useEffect(() => {
    if (phase !== 'connected') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  function hangUp() {
    leave();
    setPhase('ended');
    if (pass?.role === 'doctor') router.replace({ pathname: '/doctor/visit/[id]', params: { id: String(id) } });
    else router.back();
  }

  function toggleMute() {
    engine.current?.muteLocalAudioStream(!muted);
    setMuted(!muted);
  }
  function toggleCamera() {
    engine.current?.muteLocalVideoStream(!cameraOff);
    engine.current?.enableLocalVideo(cameraOff);
    setCameraOff(!cameraOff);
  }
  function toggleSpeaker() {
    engine.current?.setEnableSpeakerphone(!speaker);
    setSpeaker(!speaker);
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.dark}>
        <View style={styles.center}>
          <Ionicons name="call-outline" size={48} color="#FFFFFF" />
          <Text style={styles.big}>Can't join the call</Text>
          <Text style={styles.note}>{message}</Text>
          <Button label="Back" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  const status =
    phase === 'preparing'
      ? 'Connecting…'
      : phase === 'reconnecting'
        ? 'Reconnecting…'
        : phase === 'waiting'
          ? `Waiting for ${otherName} to join`
          : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <View style={styles.dark}>
      {video && otherHere && !otherVideoOff && pass ? (
        <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: pass.otherUid }} />
      ) : (
        <View style={styles.center}>
          <View style={styles.avatar}>
            <Ionicons name={pass?.role === 'patient' ? 'medkit' : 'person'} size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.big}>{pass?.role === 'patient' ? 'Your doctor' : 'Your patient'}</Text>
          <Text style={styles.note}>{video && otherHere && otherVideoOff ? 'Camera is off' : status}</Text>
        </View>
      )}

      {video && !cameraOff ? (
        <RtcSurfaceView style={styles.self} canvas={{ uid: 0 }} zOrderMediaOverlay />
      ) : null}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.pill}>
            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
            <Text style={styles.pillText}>Private · not recorded</Text>
          </View>
          {phase === 'connected' ? <Text style={styles.timer}>{status}</Text> : null}
        </View>
        {weak ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>Weak connection. Video may pause; the sound keeps going.</Text>
          </View>
        ) : null}
        <View style={styles.controls}>
          <Control icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} on={muted} onPress={toggleMute} />
          {video ? (
            <Control icon={cameraOff ? 'videocam-off' : 'videocam'} label="Camera" on={cameraOff} onPress={toggleCamera} />
          ) : null}
          {video ? <Control icon="camera-reverse" label="Flip" onPress={() => engine.current?.switchCamera()} /> : null}
          <Control icon={speaker ? 'volume-high' : 'volume-low'} label="Speaker" on={speaker} onPress={toggleSpeaker} />
          <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={hangUp} style={styles.end}>
            <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Control({ icon, label, on, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} onPress={onPress} style={styles.controlWrap}>
      <View style={[styles.control, on && styles.controlOn]}>
        <Ionicons name={icon} size={24} color={on ? colors.ink : '#FFFFFF'} />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#0B1F22' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  big: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  note: { fontSize: 16, color: '#C9D6D4', textAlign: 'center', lineHeight: 23, marginBottom: 8 },
  self: { position: 'absolute', top: 96, right: 16, width: 108, height: 160, borderRadius: 14, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  timer: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  warn: { alignSelf: 'center', backgroundColor: colors.amberTint, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginHorizontal: 20 },
  warnText: { color: colors.amberText, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 14, paddingBottom: 24, paddingHorizontal: 12 },
  controlWrap: { alignItems: 'center', gap: 6, width: 60 },
  control: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  controlOn: { backgroundColor: '#FFFFFF' },
  controlLabel: { color: '#FFFFFF', fontSize: 12 },
  end: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
});

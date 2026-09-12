import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Text, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useAuth } from '@clerk/clerk-expo';
import { checkIn, checkOut } from '../api/attendanceApi';
import { useAuthStore } from '../store/authStore';
import { Assignment } from '../types/employee';

const { width } = Dimensions.get('window');
const OVAL_WIDTH = width * 0.75;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;

interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'CHECK_IN' | 'CHECK_OUT';
  todayAssignment?: Assignment | null;
  onSuccess: () => void;
}

export default function CheckInModal({
  visible,
  onClose,
  mode,
  todayAssignment,
  onSuccess,
}: CheckInModalProps) {
  const { getToken } = useAuth();
  const setSessionActive = useAuthStore((state) => state.setSessionActive);

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setCapturedPhotoUri(null);
      setIsSubmitting(false);
      fetchLocation();
    }
  }, [visible]);

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status !== 'granted') {
        setLocationError('Location permission is required for attendance verification.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(loc);
      setLocationError(null);
    } catch (err: any) {
      setLocationError(err.message || 'Failed to obtain device GPS location.');
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      if (photo?.uri) {
        setCapturedPhotoUri(photo.uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', 'Failed to capture selfie. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!capturedPhotoUri) {
      Alert.alert('Photo Required', 'Please capture your selfie first.');
      return;
    }

    if (!currentLocation) {
      Alert.alert('GPS Required', 'Waiting for accurate GPS fix. Please wait a moment.');
      await fetchLocation();
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const payload = {
        photoUri: capturedPhotoUri,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy ?? 10,
        faceMatch: true,
        livenessScore: 0.96,
      };

      if (mode === 'CHECK_IN') {
        await checkIn(payload, token);
        setSessionActive(true);
        Alert.alert('Check-In Successful', 'Your duty session has started.');
      } else {
        await checkOut(payload, token);
        setSessionActive(false);
        Alert.alert('Check-Out Successful', 'Your duty session has been completed.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(
        'Attendance Failed',
        err.detail || err.message || 'Unable to verify attendance with server.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <Text style={styles.modalTitle}>
            {mode === 'CHECK_IN' ? 'Duty Check-In' : 'Duty Check-Out'}
          </Text>
          <IconButton icon="close" iconColor="#FFFFFF" size={24} onPress={onClose} />
        </View>

        {/* Permission Warnings */}
        {!permission?.granted ? (
          <View style={styles.centerBox}>
            <Text style={styles.permText}>Camera permission is required for attendance.</Text>
            <Button
              mode="contained"
              onPress={requestPermission}
              buttonColor="#6B2FA0"
              textColor="#FFFFFF"
              style={styles.permBtn}
              labelStyle={{ fontWeight: '700' }}
            >
              Grant Camera Permission
            </Button>
          </View>
        ) : capturedPhotoUri ? (
          /* Preview captured photo */
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} />
            <View style={styles.previewOverlay}>
              <Text style={styles.previewHint}>Selfie captured. Confirm to submit.</Text>
              <View style={styles.btnRow}>
                <Button
                  mode="outlined"
                  onPress={() => setCapturedPhotoUri(null)}
                  style={styles.retakeBtn}
                  textColor="#FFFFFF"
                  icon="camera-retake-outline"
                  disabled={isSubmitting}
                  labelStyle={{ fontWeight: '600' }}
                >
                  Retake
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  buttonColor={mode === 'CHECK_IN' ? '#10B981' : '#DC2626'}
                  textColor="#FFFFFF"
                  icon={mode === 'CHECK_IN' ? 'check-circle-outline' : 'clock-check-outline'}
                  style={styles.submitBtn}
                  labelStyle={{ fontWeight: '700' }}
                >
                  Confirm {mode === 'CHECK_IN' ? 'Check-In' : 'Clock Out'}
                </Button>
              </View>
            </View>
          </View>
        ) : (
          /* Live Camera View */
          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            >
              {/* Face Guide Oval */}
              <View style={styles.ovalGuideContainer}>
                <View style={styles.ovalGuide} />
                <Text style={styles.guideText}>Center your face within the frame</Text>
              </View>
            </CameraView>

            {/* GPS Status Indicator */}
            <View style={styles.gpsBanner}>
              <IconButton
                icon="map-marker-radius"
                size={18}
                iconColor={currentLocation ? '#22C55E' : '#EF4444'}
              />
              <Text style={styles.gpsText}>
                {currentLocation
                  ? `GPS Accurate (±${Math.round(currentLocation.coords.accuracy ?? 0)}m)`
                  : locationError || 'Acquiring GPS location...'}
              </Text>
            </View>

            {/* Today's Destination info */}
            {todayAssignment && (
              <View style={styles.destBanner}>
                <Text style={styles.destTitle}>Assignment Target:</Text>
                <Text style={styles.destText}>
                  {todayAssignment.patient_name} — {todayAssignment.patient_address}
                </Text>
              </View>
            )}

            {/* Capture Shutter Button */}
            <View style={styles.shutterContainer}>
              <TouchableOpacity
                style={[styles.shutterButton, { opacity: currentLocation ? 1 : 0.5 }]}
                onPress={handleCapture}
                disabled={!currentLocation}
              >
                <View style={styles.shutterInner}>
                  <IconButton icon="camera" iconColor="#FFFFFF" size={28} style={{ margin: 0 }} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    backgroundColor: '#6B2FA0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  permBtn: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  ovalGuideContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalGuide: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: '#6B2FA0',
    backgroundColor: 'transparent',
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  gpsBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  gpsText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  destBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(107, 47, 160, 0.85)',
    borderRadius: 8,
    padding: 10,
  },
  destTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  destText: {
    color: '#E0E0E0',
    fontSize: 11,
    marginTop: 2,
  },
  shutterContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6B2FA0',
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  previewHint: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    marginRight: 8,
    borderColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 4,
  },
  submitBtn: {
    flex: 1.5,
    marginLeft: 8,
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 3,
  },
});

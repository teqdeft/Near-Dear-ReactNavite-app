import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from '../store/AuthContext';
import { colors, font } from '../theme';
import AppSplash from '../components/AppSplash';
import AnimatedTabBar from '../components/AnimatedTabBar';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import AadhaarVerifyScreen from '../screens/auth/AadhaarVerifyScreen';
import AadhaarUploadScreen from '../screens/auth/AadhaarUploadScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';

// Driver
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import DriverTripsScreen from '../screens/driver/DriverTripsScreen';
import DriverVehicleScreen from '../screens/driver/DriverVehicleScreen';
import DriverTripDetailScreen from '../screens/driver/DriverTripDetailScreen';

// Tabs
import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/pharmacy/OrdersScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';

// Blood
import BloodHomeScreen from '../screens/blood/BloodHomeScreen';
import BecomeDonorScreen from '../screens/blood/BecomeDonorScreen';
import CreateBloodRequestScreen from '../screens/blood/CreateBloodRequestScreen';
import MyBloodRequestsScreen from '../screens/blood/MyBloodRequestsScreen';
import BloodRequestDetailScreen from '../screens/blood/BloodRequestDetailScreen';
import DonorRequestsScreen from '../screens/blood/DonorRequestsScreen';

// Ambulance
import AmbulanceHomeScreen from '../screens/ambulance/AmbulanceHomeScreen';
import BookAmbulanceScreen from '../screens/ambulance/BookAmbulanceScreen';
import AmbulanceDetailScreen from '../screens/ambulance/AmbulanceDetailScreen';

// Pharmacy
import PharmacyHomeScreen from '../screens/pharmacy/PharmacyHomeScreen';
import MedicineListScreen from '../screens/pharmacy/MedicineListScreen';
import MedicineDetailScreen from '../screens/pharmacy/MedicineDetailScreen';
import CartScreen from '../screens/pharmacy/CartScreen';
import CheckoutScreen from '../screens/pharmacy/CheckoutScreen';
import PrescriptionsScreen from '../screens/pharmacy/PrescriptionsScreen';
import OrderDetailScreen from '../screens/pharmacy/OrderDetailScreen';
import OrderSuccessScreen from '../screens/pharmacy/OrderSuccessScreen';

// Common
import SupportScreen from '../screens/common/SupportScreen';
import PrivacyPolicyScreen from '../screens/common/PrivacyPolicyScreen';
import TermsConditionsScreen from '../screens/common/TermsConditionsScreen';
import EmergencyHelpScreen from '../screens/common/EmergencyHelpScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} activeColor={colors.primary} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} activeColor={colors.ambulance} />}>
      <Tab.Screen name="DriverHome" component={DriverDashboardScreen} />
      <Tab.Screen name="DriverTrips" component={DriverTripsScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const headerStyle = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontWeight: font.bold, color: colors.text },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
};

export default function RootNavigator() {
  const { booting, isLoggedIn, profileComplete, isDriver } = useAuth();

  if (booting) return <AppSplash />;

  return (
    <Stack.Navigator screenOptions={{ ...headerStyle, headerTintColor: isDriver ? colors.ambulance : colors.primary }}>
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
          <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Verify OTP' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot password' }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset password' }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="Terms" component={TermsConditionsScreen} options={{ title: 'Terms & Conditions' }} />
          <Stack.Screen name="EmergencyHelp" component={EmergencyHelpScreen} options={{ title: 'Emergency Help' }} />
        </>
      ) : !profileComplete ? (
        <>
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: 'Complete your profile' }} />
          <Stack.Screen name="AadhaarVerify" component={AadhaarVerifyScreen} options={{ title: 'Aadhaar Verification' }} />
          <Stack.Screen name="AadhaarUpload" component={AadhaarUploadScreen} options={{ title: 'Verify Aadhaar' }} />
        </>
      ) : isDriver ? (
        <>
          <Stack.Screen name="Main" component={DriverTabs} options={{ headerShown: false }} />
          <Stack.Screen name="DriverVehicle" component={DriverVehicleScreen} options={{ title: 'My Ambulance' }} />
          <Stack.Screen name="DriverTripDetail" component={DriverTripDetailScreen} options={{ title: 'Trip details' }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="Terms" component={TermsConditionsScreen} options={{ title: 'Terms & Conditions' }} />
          <Stack.Screen name="EmergencyHelp" component={EmergencyHelpScreen} options={{ title: 'Emergency Help' }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change password' }} />
          <Stack.Screen name="AadhaarVerify" component={AadhaarVerifyScreen} options={{ title: 'Aadhaar Verification' }} />
          <Stack.Screen name="AadhaarUpload" component={AadhaarUploadScreen} options={{ title: 'Verify Aadhaar' }} />
          <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change password' }} />
          <Stack.Screen name="AadhaarVerify" component={AadhaarVerifyScreen} options={{ title: 'Aadhaar Verification' }} />
          <Stack.Screen name="AadhaarUpload" component={AadhaarUploadScreen} options={{ title: 'Verify Aadhaar' }} />

          {/* Blood module */}
          <Stack.Screen name="BloodHome" component={BloodHomeScreen} options={{ title: 'Blood Donation' }} />
          <Stack.Screen name="BecomeDonor" component={BecomeDonorScreen} options={{ title: 'Become a Donor' }} />
          <Stack.Screen name="CreateBloodRequest" component={CreateBloodRequestScreen} options={{ title: 'Request Blood' }} />
          <Stack.Screen name="MyBloodRequests" component={MyBloodRequestsScreen} options={{ title: 'My Blood Requests' }} />
          <Stack.Screen name="BloodRequestDetail" component={BloodRequestDetailScreen} options={{ title: 'Request Detail' }} />
          <Stack.Screen name="DonorRequests" component={DonorRequestsScreen} options={{ title: 'Requests for me' }} />

          {/* Ambulance module */}
          <Stack.Screen name="AmbulanceHome" component={AmbulanceHomeScreen} options={{ title: 'Ambulance' }} />
          <Stack.Screen name="BookAmbulance" component={BookAmbulanceScreen} options={{ title: 'Book Ambulance' }} />
          <Stack.Screen name="AmbulanceDetail" component={AmbulanceDetailScreen} options={{ title: 'Ambulance Status' }} />

          {/* Pharmacy module */}
          <Stack.Screen name="PharmacyHome" component={PharmacyHomeScreen} options={{ title: 'Medicine Store' }} />
          <Stack.Screen name="MedicineList" component={MedicineListScreen} options={{ title: 'Medicines' }} />
          <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} options={{ title: 'Medicine' }} />
          <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Your Cart' }} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
          <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} options={{ title: 'Prescriptions' }} />
          <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order Detail' }} />

          {/* Common */}
          <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support' }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="Terms" component={TermsConditionsScreen} options={{ title: 'Terms & Conditions' }} />
          <Stack.Screen name="EmergencyHelp" component={EmergencyHelpScreen} options={{ title: 'Emergency Help' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

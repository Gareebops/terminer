import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { Colors, Font } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.ink,
        tabBarInactiveTintColor: "rgba(23, 24, 26, 0.4)",
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.faint,
        },
        tabBarLabelStyle: { fontFamily: Font.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: Colors.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Početna",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kalendar"
        options={{
          title: "Kalendar",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rezervacije"
        options={{
          title: "Rezervacije",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vise"
        options={{
          title: "Više",
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

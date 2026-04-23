import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Alert
} from "react-native";
import Config from "./src/config/env";

function App(): React.JSX.Element {
  const [patientList, setPatientList] = useState<string[]>([]);

  useEffect(() => {
    // Initialize with sample data
    setPatientList([
      "John Doe - Critical",
      "Jane Smith - High",
      "Bob Johnson - Medium",
      "Alice Williams - Low"
    ]);
  }, []);

  const handleAddPatient = () => {
    Alert.prompt(
      "Add Patient",
      'Enter patient name and severity (e.g., "John - Critical")',
      (text) => {
        if (text.trim()) {
          setPatientList([...patientList, text]);
        }
      },
      "plain-text"
    );
  };

  const handleRemovePatient = (index: number) => {
    const newList = patientList.filter((_, i) => i !== index);
    setPatientList(newList);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2c3e50" />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {Config.environmentBadge} Triage App
          </Text>
          <Text style={styles.flavorText}>
            Flavor: {Config.flavorName} | Environment: {Config.logLevel}
          </Text>
          <Text style={styles.apiText}>API: {Config.apiUrl}</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Patient Queue</Text>

          {patientList.length === 0 ? (
            <Text style={styles.emptyText}>No patients in queue</Text>
          ) : (
            patientList.map((patient, index) => (
              <TouchableOpacity
                key={index}
                style={styles.patientCard}
                onPress={() => handleRemovePatient(index)}
              >
                <Text style={styles.patientName}>{patient}</Text>
                <Text style={styles.patientHint}>Tap to remove</Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={styles.addButton} onPress={handleAddPatient}>
            <Text style={styles.addButtonText}>+ Add Patient</Text>
          </TouchableOpacity>

          <View style={styles.configSection}>
            <Text style={styles.configTitle}>Build Info</Text>
            <Text style={styles.configItem}>
              Features Enabled: {Config.featureFlagsEnabled ? "Yes" : "No"}
            </Text>
            <Text style={styles.configItem}>
              Analytics: {Config.analyticsEnabled ? "Enabled" : "Disabled"}
            </Text>
            <Text style={styles.configItem}>Log Level: {Config.logLevel}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },
  scrollView: {
    flex: 1
  },
  header: {
    backgroundColor: "#2c3e50",
    padding: 20,
    marginBottom: 10
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8
  },
  flavorText: {
    fontSize: 14,
    color: "#ecf0f1",
    marginBottom: 4
  },
  apiText: {
    fontSize: 12,
    color: "#bdc3c7"
  },
  content: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#2c3e50"
  },
  emptyText: {
    fontSize: 14,
    color: "#7f8c8d",
    fontStyle: "italic",
    marginBottom: 16
  },
  patientCard: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2
  },
  patientName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#2c3e50"
  },
  patientHint: {
    fontSize: 12,
    color: "#95a5a6",
    marginTop: 4
  },
  addButton: {
    backgroundColor: "#27ae60",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: "center"
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  configSection: {
    backgroundColor: "#ecf0f1",
    padding: 16,
    borderRadius: 8,
    marginTop: 16
  },
  configTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 10
  },
  configItem: {
    fontSize: 13,
    color: "#34495e",
    marginBottom: 6
  }
});

export default App;

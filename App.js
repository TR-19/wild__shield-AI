import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";

import {
  Shield,
  MapPin,
  PhoneCall,
  Mail,
  Users,
  Radar,
  ArrowRight,
  Mic,
  FileDown,
  Activity,
  WifiOff,
  Wifi,
  Bot,
  Plane,
  Layers,
  Settings,
} from "lucide-react";

/* ================================
   FlyToLocation
================================ */
function FlyToLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo(location, 14, { duration: 1.5 });
    }
  }, [location, map]);

  return null;
}

/* ================================
   Map Click Handler
================================ */
function MapClickHandler({ selectedIncident, addManualReport }) {
  useMapEvents({
    click(e) {
      if (!selectedIncident) {
        alert("⚠️ Select a threat type first!");
        return;
      }
      addManualReport([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}

export default function App() {
  const [screen, setScreen] = useState("home");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedZone, setSelectedZone] = useState("Bandipur Forest Zone");

  const forestZones = [
    { name: "Bandipur Forest Zone", center: [11.667, 76.633] },
    { name: "Nagarhole Wildlife Zone", center: [12.04, 76.09] },
    { name: "Mudumalai Tiger Reserve", center: [11.58, 76.53] },
    { name: "Wayanad Wildlife Sanctuary", center: [11.715, 76.2] },
  ];

  const currentZone =
    forestZones.find((z) => z.name === selectedZone) || forestZones[0];

  const forestHQ = { name: "Forest HQ", position: [11.667, 76.633] };

  const incidentTypes = [
    { name: "gunshot", priority: "CRITICAL", icon: "🔫" },
    { name: "chainsaw", priority: "HIGH", icon: "🪓" },
    { name: "vehicle", priority: "MEDIUM", icon: "🚙" },
    { name: "intrusion", priority: "LOW", icon: "👣" },
    { name: "logging", priority: "HIGH", icon: "🌲" },
    { name: "other", priority: "MANUAL", icon: "❓" },
  ];

  const [selectedIncident, setSelectedIncident] = useState(null);

  const [reports, setReports] = useState([]);
  const [selectedReportLocation, setSelectedReportLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [dispatchInfo, setDispatchInfo] = useState(null);

  const [criticalAlert, setCriticalAlert] = useState(false);
  const [notification, setNotification] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [sirenAudio, setSirenAudio] = useState(null);

  // offline mode
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingSync, setPendingSync] = useState([]);

  // night mode
  const [nightMode, setNightMode] = useState(false);

  // drone simulation
  const [droneRoute, setDroneRoute] = useState(null);

  // LIVE ACOUSTIC AI
  const [micStatus, setMicStatus] = useState("OFF");
  const [liveThreat, setLiveThreat] = useState("SILENCE");
  const [confidence, setConfidence] = useState(0);
  const [decibel, setDecibel] = useState(0);
  const [monitoring, setMonitoring] = useState(false);

  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);

  const [lastAudioClip, setLastAudioClip] = useState(null);

  // Sensor Nodes
  const [sensors, setSensors] = useState([
    {
      id: "S1",
      name: "Sensor Node A",
      position: [11.668, 76.631],
      battery: 92,
      signal: 88,
      status: "ACTIVE",
      lastDetected: "NONE",
    },
    {
      id: "S2",
      name: "Sensor Node B",
      position: [11.664, 76.639],
      battery: 80,
      signal: 70,
      status: "ACTIVE",
      lastDetected: "NONE",
    },
    {
      id: "S3",
      name: "Sensor Node C",
      position: [11.672, 76.645],
      battery: 67,
      signal: 77,
      status: "ACTIVE",
      lastDetected: "NONE",
    },
  ]);

  // Patrol Teams
  const [patrolTeams, setPatrolTeams] = useState([
    {
      id: 1,
      name: "Alpha Team",
      position: [11.67, 76.63],
      phone: "9111111111",
      status: "AVAILABLE",
      description:
        "Rapid response team trained for gunshot alerts and high-risk tracking missions.",
    },
    {
      id: 2,
      name: "Bravo Team",
      position: [11.66, 76.64],
      phone: "9222222222",
      status: "AVAILABLE",
      description:
        "Patrol unit specialized in trap detection, animal rescue support, and perimeter scanning.",
    },
    {
      id: 3,
      name: "Charlie Team",
      position: [11.675, 76.645],
      phone: "9333333333",
      status: "AVAILABLE",
      description:
        "Night surveillance unit equipped for suspicious movement detection and thermal monitoring.",
    },
  ]);

  /* ================================
     UTILITIES
================================ */
  const getDistance = (a, b) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return "#dc2626";
      case "HIGH":
        return "#ea580c";
      case "MEDIUM":
        return "#ca8a04";
      case "LOW":
        return "#2563eb";
      default:
        return "#7c3aed";
    }
  };

  const getActionText = (priority) => {
    if (priority === "CRITICAL")
      return "🚨 Immediate dispatch + backup required + inform HQ + drone scan!";
    if (priority === "HIGH")
      return "⚠️ Dispatch ranger team + monitor with drone.";
    if (priority === "MEDIUM") return "👀 Monitor zone + patrol check nearby.";
    if (priority === "LOW") return "📝 Log and observe silently.";
    return "Manual review required.";
  };

  const findNearestAvailableTeam = (location) => {
    const availableTeams = patrolTeams.filter((t) => t.status === "AVAILABLE");
    if (availableTeams.length === 0) return patrolTeams[0];

    let nearest = availableTeams[0];
    let minDist = getDistance(location, availableTeams[0].position);

    availableTeams.forEach((team) => {
      const dist = getDistance(location, team.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = team;
      }
    });

    return nearest;
  };

  const estimateETA = (teamPos, incidentPos) => {
    const dist = getDistance(teamPos, incidentPos);
    const eta = Math.max(2, Math.floor(dist * 120));
    return eta;
  };

  const triangulateThreatLocation = (sensorPositions) => {
    const avgLat =
      sensorPositions.reduce((sum, p) => sum + p[0], 0) /
      sensorPositions.length;

    const avgLng =
      sensorPositions.reduce((sum, p) => sum + p[1], 0) /
      sensorPositions.length;

    return [avgLat, avgLng];
  };

  /* ================================
     THREAT LEVEL
================================ */
  const threatMeter = useMemo(() => {
    const critical = reports.filter((r) => r.priority === "CRITICAL").length;
    const high = reports.filter((r) => r.priority === "HIGH").length;

    if (critical >= 2) return { level: "EXTREME", color: "#dc2626" };
    if (critical === 1 || high >= 2) return { level: "HIGH", color: "#ea580c" };
    if (reports.length >= 3) return { level: "MEDIUM", color: "#ca8a04" };
    if (reports.length >= 1) return { level: "LOW", color: "#2563eb" };
    return { level: "SAFE", color: "#16a34a" };
  }, [reports]);

  const getRiskScore = () => {
    const nightBoost = nightMode ? 20 : 0;
    const base = reports.length * 10;
    const criticalBoost =
      reports.filter((r) => r.priority === "CRITICAL").length * 25;
    return Math.min(100, base + criticalBoost + nightBoost);
  };

  /* ================================
     EXPORT CSV
================================ */
  const exportCSV = () => {
    if (reports.length === 0) {
      alert("No reports available to export!");
      return;
    }

    const header =
      "Incident,Priority,Confidence,Sensor,Team,ETA(min),Latitude,Longitude,Time\n";

    const rows = reports
      .map(
        (r) =>
          `${r.incident},${r.priority},${r.confidence}%,${r.sensor || "MANUAL"},${
            r.team?.name || "N/A"
          },${r.eta || "N/A"},${r.location[0]},${r.location[1]},${r.time}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "wildshield_reports.csv";
    a.click();

    window.URL.revokeObjectURL(url);
  };

  /* ================================
     SMS DISPATCH (DEMO)
================================ */
  const sendSMS = (phone, message) => {
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  };

  /* ================================
     OFFLINE SYNC
================================ */
  const syncPendingReports = () => {
    if (pendingSync.length === 0) {
      alert("No offline alerts to sync.");
      return;
    }

    setReports((prev) => [...prev, ...pendingSync]);
    setPendingSync([]);
    alert("✅ Offline alerts synced successfully!");
  };

  /* ================================
     DRONE SCAN SIMULATION
================================ */
  const deployDrone = (incidentLocation) => {
    const droneStart = forestHQ.position;

    const mid = [
      (droneStart[0] + incidentLocation[0]) / 2 + 0.002,
      (droneStart[1] + incidentLocation[1]) / 2 + 0.001,
    ];

    setDroneRoute({
      points: [droneStart, mid, incidentLocation],
    });

    setTimeout(() => {
      setDroneRoute(null);
      alert("🛰️ Drone Scan Complete: No confirmed human target detected.");
    }, 7000);
  };

  /* ================================
     MAIN REPORT CREATION
================================ */
  const createIncidentReport = (location, incidentName, priority, sensorId) => {
    const team = findNearestAvailableTeam(location);
    const conf = Math.floor(Math.random() * 18) + 82;
    const eta = estimateETA(team.position, location);

    const newReport = {
      id: Date.now(),
      location,
      incident: incidentName,
      priority,
      confidence: conf,
      sensor: sensorId || "MANUAL",
      team,
      eta,
      time: new Date().toLocaleTimeString(),
    };

    if (offlineMode) {
      setPendingSync((prev) => [...prev, newReport]);
      setNotification({
        title: `${incidentName.toUpperCase()} stored offline`,
        priority,
        confidence: conf,
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setReports((prev) => [...prev, newReport]);

    if (sensorId) {
      setSensors((prev) =>
        prev.map((s) =>
          s.id === sensorId
            ? { ...s, lastDetected: incidentName.toUpperCase() }
            : s
        )
      );
    }

    setNotification({
      title: `${incidentName.toUpperCase()} Detected`,
      priority,
      confidence: conf,
    });
    setTimeout(() => setNotification(null), 5000);

    setDispatchInfo({
      incident: incidentName,
      priority,
      team,
      location,
      confidence: conf,
      eta,
      action: getActionText(priority),
    });

    setPatrolTeams((prev) =>
      prev.map((t) =>
        t.id === team.id ? { ...t, status: "DISPATCHED" } : t
      )
    );

    setTimeout(() => {
      setPatrolTeams((prev) =>
        prev.map((t) =>
          t.id === team.id ? { ...t, status: "AVAILABLE" } : t
        )
      );
    }, 9000);

    const midPoint = [
      (team.position[0] + location[0]) / 2 + 0.002,
      (team.position[1] + location[1]) / 2 - 0.002,
    ];

    setRoute({ points: [team.position, midPoint, location] });

    if (priority === "CRITICAL") {
      setCriticalAlert(true);

      if (!isMuted) {
        const siren = new Audio("/sounds/siren.mp3");
        siren.loop = true;
        siren.play();
        setSirenAudio(siren);

        setTimeout(() => {
          siren.pause();
          siren.currentTime = 0;
          setCriticalAlert(false);
        }, 5000);
      } else {
        setTimeout(() => setCriticalAlert(false), 5000);
      }

      deployDrone(location);
    }
  };

  const addManualReport = (location) => {
    let name =
      selectedIncident.name === "other"
        ? prompt("Enter custom incident:") || "unknown"
        : selectedIncident.name;

    createIncidentReport(location, name, selectedIncident.priority, "MANUAL");
  };

  /* ================================
     MICROPHONE MONITORING
================================ */
  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      setMicStatus("ACTIVE");
      setMonitoring(true);

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateAudio = () => {
        analyser.getByteFrequencyData(dataArray);

        const avg =
          dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

        const db = Math.min(120, Math.floor(avg));
        setDecibel(db);

        if (db > (nightMode ? 35 : 45)) {
          const randomThreat =
            incidentTypes[Math.floor(Math.random() * (incidentTypes.length - 1))];

          setLiveThreat(randomThreat.name.toUpperCase());
          setConfidence(Math.floor(Math.random() * 20) + 75);
        } else {
          setLiveThreat("SILENCE");
          setConfidence(0);
        }

        if (monitoring) requestAnimationFrame(updateAudio);
      };

      updateAudio();
    } catch (err) {
      alert("Microphone permission denied or unavailable.");
      setMicStatus("OFF");
    }
  };

  const stopMonitoring = () => {
    setMonitoring(false);
    setMicStatus("OFF");
    setLiveThreat("SILENCE");
    setConfidence(0);
    setDecibel(0);

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  /* ================================
     RECORD EVIDENCE
================================ */
  const recordEvidence = () => {
    if (!audioStreamRef.current) {
      alert("Start monitoring first to record evidence.");
      return;
    }

    chunksRef.current = [];

    const recorder = new MediaRecorder(audioStreamRef.current);

    recorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setLastAudioClip(url);
    };

    recorder.start();

    setTimeout(() => {
      recorder.stop();
    }, 5000);

    alert("🎙️ Recording evidence for 5 seconds...");
  };

  /* ================================
     SENSOR SIMULATION
================================ */
  const triggerSensorDetection = () => {
    const activeSensors = sensors.filter((s) => s.status === "ACTIVE");
    if (activeSensors.length < 2) {
      alert("Need at least 2 active sensors for triangulation.");
      return;
    }

    const randomThreat =
      incidentTypes[Math.floor(Math.random() * (incidentTypes.length - 1))];

    const chosenSensors = activeSensors.slice(0, 3);
    const triangulated = triangulateThreatLocation(
      chosenSensors.map((s) => s.position)
    );

    createIncidentReport(
      triangulated,
      randomThreat.name,
      randomThreat.priority,
      chosenSensors[0].id
    );

    alert(
      `📡 Sensor Network Detected ${randomThreat.name.toUpperCase()} (Triangulated Location Generated)`
    );
  };

  /* ================================
     STOP SIREN WHEN MUTED
================================ */
  useEffect(() => {
    if (isMuted && sirenAudio) {
      sirenAudio.pause();
      sirenAudio.currentTime = 0;
    }
  }, [isMuted, sirenAudio]);

  /* ================================
     HOME SCREEN
================================ */
  if (screen === "home") {
    return (
      <div className="intro-page">
        <div className="orb orb1"></div>
        <div className="orb orb2"></div>
        <div className="forest-fog"></div>
        <div className="radar-scan"></div>
        <div className="animal-silhouette"></div>

        <div className="intro-navbar">
          <div className="brand">
            <Shield size={26} />
            <span>Forest Guardian AI</span>
          </div>

          <div className="nav-links">
            <a href="#about">About</a>
            <a href="#teams">Teams</a>
            <a href="#contact">Contact</a>
          </div>
        </div>

        <div className="intro-hero">
          <div className="hero-left">
            <h1 className="fade-in">
              Real-Time <span>Acoustic Threat Detection</span>
            </h1>

            <p className="slide-up">
              Forest Guardian is an AI-powered acoustic monitoring platform that
              detects gunshots, chainsaws, vehicle movement, and intrusion in
              real time using sensor networks and AI classification. It
              automatically generates alerts, triangulates locations, and
              dispatches ranger teams instantly.
            </p>

            <div className="hero-features">
              <div className="feature-card">
                <Mic size={22} />
                <p>Live Microphone Monitoring</p>
              </div>
              <div className="feature-card">
                <Radar size={22} />
                <p>AI Threat Classification</p>
              </div>
              <div className="feature-card">
                <Layers size={22} />
                <p>Sensor Network Triangulation</p>
              </div>
              <div className="feature-card">
                <Plane size={22} />
                <p>Drone Scan Support</p>
              </div>
            </div>

            <div className="zone-select-box">
              <MapPin size={20} />
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {forestZones.map((zone, idx) => (
                  <option key={idx} value={zone.name}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <button className="enter-btn" onClick={() => setScreen("dashboard")}>
              Enter Monitoring Dashboard <ArrowRight size={20} />
            </button>
          </div>

          <div className="hero-right">
            <div
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.85)",
                borderRadius: "18px",
                padding: "18px",
                border: "1px solid rgba(15,23,42,0.12)",
                boxShadow: "0px 8px 20px rgba(15,23,42,0.12)",
              }}
            >
              <h3 style={{ color: "#2563eb", marginBottom: "10px" }}>
                🎙️ Live Acoustic Monitor
              </h3>

              <p style={{ marginBottom: "6px", color: "#475569" }}>
                Mic Status:{" "}
                <b style={{ color: micStatus === "ACTIVE" ? "green" : "red" }}>
                  {micStatus}
                </b>
              </p>

              <p style={{ marginBottom: "6px", color: "#475569" }}>
                Current Sound: <b>{liveThreat}</b>
              </p>

              <p style={{ marginBottom: "10px", color: "#475569" }}>
                Confidence:{" "}
                <b style={{ color: confidence > 0 ? "#16a34a" : "#64748b" }}>
                  {confidence}%
                </b>
              </p>

              <p style={{ marginBottom: "10px", color: "#475569" }}>
                Estimated dB: <b>{decibel}</b>
              </p>

              <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: "6px",
                      height: `${Math.random() * 40 + 10}px`,
                      background: "#2563eb",
                      borderRadius: "5px",
                      animation: "wave 1s infinite ease-in-out",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="intro-section" id="about">
          <h2>
            <Shield size={26} /> About the System
          </h2>
          <p>
            Illegal activities like poaching, logging, and intrusion threaten
            wildlife ecosystems. Traditional monitoring is reactive and
            resource-intensive. Forest Guardian AI enables real-time acoustic
            detection using AI classification, sensor triangulation, emergency
            alerts, and ranger dispatch support.
          </p>
        </div>

        <div className="intro-section" id="teams">
          <h2>
            <Users size={26} /> Ranger Patrol Teams
          </h2>

          <div className="team-grid">
            {patrolTeams.map((team) => (
              <div key={team.id} className="team-card">
                <h3>🚔 {team.name}</h3>
                <p>{team.description}</p>
                <p>
                  <b>Status:</b>{" "}
                  <span className="status-tag">{team.status}</span>
                </p>
                <p>
                  <PhoneCall size={16} /> {team.phone}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="intro-section" id="contact">
          <h2>
            <Mail size={26} /> Emergency Contact
          </h2>

          <div className="contact-box">
            <p>
              📧 Email: <b>forestguardian.support@gmail.com</b>
            </p>
            <p>
              ☎️ Emergency Hotline: <b>1800-FOREST-911</b>
            </p>
            <p>
              📍 Forest HQ:{" "}
              <b>
                {forestHQ.position[0]}, {forestHQ.position[1]}
              </b>
            </p>
          </div>
        </div>

        <div className="intro-footer">
          <p>© 2026 Forest Guardian AI | Acoustic Threat Monitoring System</p>
        </div>

        <style>
          {`
            @keyframes wave {
              0% { transform: scaleY(0.3); }
              50% { transform: scaleY(1); }
              100% { transform: scaleY(0.3); }
            }
          `}
        </style>
      </div>
    );
  }

  /* ================================
     DASHBOARD SCREEN
================================ */
  const totalIncidents = reports.length;
  const criticalCount = reports.filter((r) => r.priority === "CRITICAL").length;
  const highCount = reports.filter((r) => r.priority === "HIGH").length;
  const mediumCount = reports.filter((r) => r.priority === "MEDIUM").length;

  const riskScore = getRiskScore();

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-title">🌍 Forest Guardian Control</div>
        <div className="sidebar-subtitle">
          Acoustic AI + Sensor Network Monitoring
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            className="incident-btn"
            onClick={() => setActiveTab("dashboard")}
          >
            <Activity size={16} /> Dashboard
          </button>

          <button
            className="incident-btn"
            onClick={() => setActiveTab("sensors")}
          >
            <Radar size={16} /> Sensors
          </button>

          <button
            className="incident-btn"
            onClick={() => setActiveTab("analytics")}
          >
            <Layers size={16} /> Analytics
          </button>

          <button className="incident-btn" onClick={() => setActiveTab("model")}>
            <Bot size={16} /> AI Model
          </button>

          <button
            className="incident-btn"
            onClick={() => setActiveTab("settings")}
          >
            <Settings size={16} /> Settings
          </button>
        </div>

        {/* Threat Level */}
        <div
          style={{
            marginTop: "14px",
            background: "white",
            padding: "12px",
            borderRadius: "14px",
            border: "1px solid rgba(15,23,42,0.12)",
            boxShadow: "0px 6px 16px rgba(15,23,42,0.08)",
          }}
        >
          <h4 style={{ marginBottom: "6px" }}>⚡ Threat Level</h4>
          <p style={{ fontWeight: "bold", color: threatMeter.color }}>
            {threatMeter.level}
          </p>
          <p style={{ fontSize: "13px", color: "#475569" }}>
            Risk Score: <b>{riskScore}/100</b>
          </p>
        </div>

        {/* MAIN TAB CONTENT */}
        {activeTab === "dashboard" && (
          <>
            <h3 style={{ marginTop: "18px" }}>🎯 Manual Threat Reporting</h3>

            <div className="incident-buttons">
              {incidentTypes.map((type, index) => (
                <button
                  key={index}
                  className={`incident-btn ${
                    selectedIncident?.name === type.name ? "active" : ""
                  }`}
                  onClick={() => setSelectedIncident(type)}
                >
                  {type.icon} {type.name.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              style={{
                marginTop: "14px",
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
                background: "linear-gradient(90deg,#16a34a,#22c55e)",
                color: "white",
                display: "flex",
                gap: "8px",
                justifyContent: "center",
                alignItems: "center",
              }}
              onClick={exportCSV}
            >
              <FileDown size={18} /> Export Reports CSV
            </button>

            <div className="reports-section">
              <h3>📌 Threat Timeline</h3>

              {reports.length === 0 && (
                <p style={{ fontSize: "13px", color: "#64748b" }}>
                  No incidents reported yet.
                </p>
              )}

              {reports
                .slice()
                .reverse()
                .map((report) => (
                  <div
                    key={report.id}
                    className="report-card"
                    onClick={() => setSelectedReportLocation(report.location)}
                  >
                    <h4>{report.incident.toUpperCase()}</h4>
                    <p>
                      Priority:{" "}
                      <b style={{ color: getPriorityColor(report.priority) }}>
                        {report.priority}
                      </b>
                    </p>
                    <p>Confidence: {report.confidence}%</p>
                    <p>Sensor: {report.sensor}</p>
                    <p>
                      ETA: <b>{report.eta} min</b>
                    </p>

                    <div
                      style={{
                        height: "8px",
                        width: "100%",
                        background: "#e2e8f0",
                        borderRadius: "10px",
                        marginTop: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${report.confidence}%`,
                          background: "#2563eb",
                        }}
                      ></div>
                    </div>

                    <p style={{ marginTop: "6px" }}>
                      Assigned: {report.team?.name}
                    </p>
                    <p>Time: {report.time}</p>
                  </div>
                ))}
            </div>
          </>
        )}

        {activeTab === "sensors" && (
          <>
            <h3 style={{ marginTop: "18px" }}>📡 Sensor Network</h3>

            {sensors.map((s) => (
              <div key={s.id} className="report-card">
                <h4>
                  {s.name} ({s.id})
                </h4>
                <p>Status: {s.status}</p>
                <p>Battery: {s.battery}%</p>
                <p>Signal: {s.signal}%</p>
                <p>Last Detected: {s.lastDetected}</p>
              </div>
            ))}

            <button
              className="dispatch-btn dispatch"
              style={{ width: "100%", marginTop: "12px" }}
              onClick={triggerSensorDetection}
            >
              📡 Simulate Sensor Detection + Triangulation
            </button>
          </>
        )}

        {activeTab === "analytics" && (
          <>
            <h3 style={{ marginTop: "18px" }}>📊 Predictive Analytics</h3>

            <div className="report-card">
              <h4>🔥 Poaching Risk Heatmap Score</h4>
              <p>
                Risk Score: <b>{riskScore}/100</b>
              </p>
              <p>
                Night Mode Boost: <b>{nightMode ? "ON (+20)" : "OFF"}</b>
              </p>
              <p>
                AI Suggestion:{" "}
                <b>
                  {riskScore > 70
                    ? "Increase night patrols + drone scan."
                    : riskScore > 40
                    ? "Monitor frequently and deploy sensors."
                    : "Normal patrol sufficient."}
                </b>
              </p>
            </div>

            <div className="report-card">
              <h4>📈 Detection Pattern</h4>
              <p>Critical Threats: {criticalCount}</p>
              <p>High Threats: {highCount}</p>
              <p>Medium Threats: {mediumCount}</p>
              <p>Total Reports: {totalIncidents}</p>
            </div>
          </>
        )}

        {activeTab === "model" && (
          <>
            <h3 style={{ marginTop: "18px" }}>🧠 AI Model Explanation</h3>

            <div className="report-card">
              <h4>Model Pipeline</h4>
              <p>✔ Input: Acoustic sensor audio stream</p>
              <p>✔ Feature Extraction: MFCC / Spectrogram</p>
              <p>✔ Model: CNN / YAMNet style classifier</p>
              <p>✔ Output: Threat label + confidence score</p>
              <p>✔ Decision Engine: Priority escalation rules</p>
            </div>

            <div className="report-card">
              <h4>Training Dataset (Example)</h4>
              <p>• UrbanSound8K</p>
              <p>• ESC-50</p>
              <p>• Custom forest gunshot / chainsaw recordings</p>
            </div>

            <div className="report-card">
              <h4>Deployment</h4>
              <p>✔ Edge sensor nodes send predictions to HQ</p>
              <p>✔ Alerts generated instantly</p>
              <p>✔ Ranger teams dispatched with ETA + route</p>
              <p>✔ Offline sync supported for remote zones</p>
            </div>
          </>
        )}

        {activeTab === "settings" && (
          <>
            <h3 style={{ marginTop: "18px" }}>⚙️ System Settings</h3>

            <div className="report-card">
              <h4>Microphone Monitoring</h4>
              <p>
                Status:{" "}
                <b style={{ color: micStatus === "ACTIVE" ? "green" : "red" }}>
                  {micStatus}
                </b>
              </p>

              {!monitoring ? (
                <button
                  className="dispatch-btn dispatch"
                  style={{ width: "100%", marginTop: "10px" }}
                  onClick={startMonitoring}
                >
                  🎙️ Start Monitoring
                </button>
              ) : (
                <button
                  className="dispatch-btn cancel"
                  style={{ width: "100%", marginTop: "10px" }}
                  onClick={stopMonitoring}
                >
                  ⛔ Stop Monitoring
                </button>
              )}

              <button
                className="dispatch-btn dispatch"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={recordEvidence}
              >
                🎧 Record 5s Evidence
              </button>

              {lastAudioClip && (
                <audio
                  controls
                  style={{ width: "100%", marginTop: "10px" }}
                  src={lastAudioClip}
                />
              )}
            </div>

            <div className="report-card">
              <h4>Night Mode</h4>
              <p>
                <b>{nightMode ? "🌙 ENABLED" : "☀️ DISABLED"}</b>
              </p>
              <button
                className="dispatch-btn dispatch"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={() => setNightMode(!nightMode)}
              >
                Toggle Night Mode
              </button>
            </div>

            <div className="report-card">
              <h4>Offline Mode</h4>
              <p>
                {offlineMode ? (
                  <span style={{ color: "red", fontWeight: "bold" }}>
                    <WifiOff size={16} /> OFFLINE ACTIVE
                  </span>
                ) : (
                  <span style={{ color: "green", fontWeight: "bold" }}>
                    <Wifi size={16} /> ONLINE
                  </span>
                )}
              </p>

              <button
                className="dispatch-btn dispatch"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={() => setOfflineMode(!offlineMode)}
              >
                Toggle Offline Mode
              </button>

              <button
                className="dispatch-btn dispatch"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={syncPendingReports}
              >
                🔄 Sync Offline Alerts ({pendingSync.length})
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: "20px" }}>
          <h3 style={{ marginBottom: "10px" }}>📞 Emergency Contacts</h3>

          <div className="report-card">
            <p>🏢 Forest HQ: 1800-FOREST-911</p>
            <p>🚓 Police Control: 100</p>
            <p>🩺 Rescue Unit: 108</p>
            <p>📧 Email: forestguardian.support@gmail.com</p>
          </div>
        </div>
      </div>

      {/* MAP SIDE */}
      <div className="map-container">
        {criticalAlert && (
          <div className="critical-alert">
            🚨 CRITICAL ALERT! Immediate action required!
          </div>
        )}

        {notification && (
          <div
            style={{
              position: "absolute",
              top: "90px",
              right: "25px",
              background: "white",
              padding: "14px 18px",
              borderRadius: "16px",
              border: "1px solid rgba(15,23,42,0.12)",
              boxShadow: "0px 10px 20px rgba(15,23,42,0.18)",
              zIndex: 2000,
              minWidth: "280px",
              animation: "fadeIn 0.5s ease",
            }}
          >
            <h4 style={{ marginBottom: "6px", color: "#2563eb" }}>
              🚨 {notification.title}
            </h4>
            <p style={{ color: "#475569" }}>
              Priority:{" "}
              <b style={{ color: getPriorityColor(notification.priority) }}>
                {notification.priority}
              </b>
            </p>
            <p style={{ color: "#475569" }}>
              Confidence: <b>{notification.confidence}%</b>
            </p>
          </div>
        )}

        <div className="topbar">
          <div className="topbar-item">
            <h3>Total</h3>
            <p>{totalIncidents}</p>
          </div>

          <div className="topbar-item">
            <h3>Critical</h3>
            <p>{criticalCount}</p>
          </div>

          <div className="topbar-item">
            <h3>Risk</h3>
            <p style={{ fontWeight: "bold", color: threatMeter.color }}>
              {riskScore}/100
            </p>
          </div>

          <div className="topbar-item">
            <h3>Mic</h3>
            <p style={{ fontWeight: "bold", color: "#16a34a" }}>
              {micStatus}
            </p>
          </div>

          <div className="topbar-item">
            <h3>dB</h3>
            <p>{decibel}</p>
          </div>

          <div className="topbar-item">
            <h3>Mode</h3>
            <p>{nightMode ? "🌙 Night" : "☀️ Day"}</p>
          </div>

          <div className="topbar-item">
            <h3>Siren</h3>
            <button
              className="mute-btn"
              onClick={() => {
                setIsMuted(!isMuted);
                if (sirenAudio) {
                  sirenAudio.pause();
                  sirenAudio.currentTime = 0;
                }
              }}
            >
              {isMuted ? "🔇 Muted" : "🔊 On"}
            </button>
          </div>
        </div>

        <MapContainer
          center={currentZone.center}
          zoom={13}
          className="leaflet-container"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <MapClickHandler
            selectedIncident={selectedIncident}
            addManualReport={addManualReport}
          />

          <FlyToLocation location={selectedReportLocation} />

          {/* HQ */}
          <Marker position={forestHQ.position}>
            <Popup>🏢 {forestHQ.name}</Popup>
          </Marker>

          {/* Sensors */}
          {sensors.map((s) => (
            <Marker key={s.id} position={s.position}>
              <Popup>
                📡 <b>{s.name}</b> <br />
                Battery: {s.battery}% <br />
                Signal: {s.signal}% <br />
                Status: {s.status} <br />
                Last: {s.lastDetected}
              </Popup>
            </Marker>
          ))}

          {/* Patrol Teams */}
          {patrolTeams.map((team) => (
            <Marker key={team.id} position={team.position}>
              <Popup>
                🚔 <b>{team.name}</b> <br />
                Status: <b>{team.status}</b> <br />
                Phone: {team.phone}
              </Popup>
            </Marker>
          ))}

          {/* Reports */}
          {reports.map((report) => (
            <Marker key={report.id} position={report.location}>
              <Popup>
                🚨 <b>{report.incident.toUpperCase()}</b> <br />
                Priority: {report.priority} <br />
                Confidence: {report.confidence}% <br />
                Sensor: {report.sensor} <br />
                Team: {report.team?.name} <br />
                ETA: {report.eta} min <br />
                Time: {report.time}
              </Popup>
            </Marker>
          ))}

          {/* Heat circles */}
          {reports.map((report) => (
            <Circle
              key={report.id + "-circle"}
              center={report.location}
              radius={
                report.priority === "CRITICAL"
                  ? 1000
                  : report.priority === "HIGH"
                  ? 750
                  : report.priority === "MEDIUM"
                  ? 550
                  : 350
              }
              pathOptions={{
                color: getPriorityColor(report.priority),
                fillOpacity: 0.18,
              }}
            />
          ))}

          {/* Ranger route */}
          {route && (
            <Polyline
              positions={route.points}
              pathOptions={{ color: "lime", weight: 4 }}
            />
          )}

          {/* Drone route */}
          {droneRoute && (
            <Polyline
              positions={droneRoute.points}
              pathOptions={{ color: "purple", weight: 3, dashArray: "6" }}
            />
          )}
        </MapContainer>

        {/* Dispatch Panel */}
        {dispatchInfo && (
          <div className="dispatch-panel">
            <h3>🚔 Dispatch Info</h3>
            <p>
              <b>Incident:</b> {dispatchInfo.incident}
            </p>
            <p>
              <b>Priority:</b>{" "}
              <span style={{ color: getPriorityColor(dispatchInfo.priority) }}>
                {dispatchInfo.priority}
              </span>
            </p>
            <p>
              <b>Confidence:</b> {dispatchInfo.confidence}%
            </p>
            <p>
              <b>Assigned Team:</b> {dispatchInfo.team.name}
            </p>
            <p>
              <b>ETA:</b> {dispatchInfo.eta} min
            </p>
            <p>
              <b>Action:</b> {dispatchInfo.action}
            </p>

            <div className="dispatch-buttons">
              <button
                className="dispatch-btn dispatch"
                onClick={() =>
                  sendSMS(
                    dispatchInfo.team.phone,
                    `🚨 FOREST GUARDIAN ALERT!\n\nIncident: ${dispatchInfo.incident}\nPriority: ${dispatchInfo.priority}\nConfidence: ${dispatchInfo.confidence}%\nETA: ${dispatchInfo.eta} min\nLocation: ${dispatchInfo.location[0]}, ${dispatchInfo.location[1]}\n\nAction: ${dispatchInfo.action}`
                  )
                }
              >
                📩 Send SMS
              </button>

              <button
                className="dispatch-btn dispatch"
                onClick={() => deployDrone(dispatchInfo.location)}
              >
                🛰️ Drone Scan
              </button>

              <button
                className="dispatch-btn cancel"
                onClick={() => setDispatchInfo(null)}
              >
                ❌ Close
              </button>
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes wave {
            0% { transform: scaleY(0.3); }
            50% { transform: scaleY(1); }
            100% { transform: scaleY(0.3); }
          }
        `}
      </style>
    </div>
  );
}
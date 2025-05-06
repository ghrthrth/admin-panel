import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';

import { theme } from 'antd';
import { Spin } from 'antd';
import './PatientMonitoring.css';
import useAppStore from '@/stores/app.ts'
import { usePatientStore } from '@/stores/patientStore.ts'

const { useToken } = theme;

interface PatientData {
  patientId: string;  // Changed from clientId to patientId
  pressure?: {
    systolic: number;
    diastolic: number;
  };
  bloodSugar?: number;
  pulse?: number;
  lastUpdate?: string;
  history?: MedicalDataPoint[];
  disconnected?: boolean;
}

interface MedicalDataPoint {
  timestamp: string;
  pressure: {
    systolic: number;
    diastolic: number;
  };
  bloodSugar: number;
  pulse: number;
}

interface WebSocketMessage {
  type: string;
  patientId: string;  // Changed from any to string
  status?: string;
  error?: string;
  pressure?: {
    systolic: number;
    diastolic: number;
  };
  bloodSugar?: number;
  pulse?: number;
}

const PatientMonitoring: React.FC = () => {
  const { token } = useToken();
  const { theme: currentTheme } = useAppStore();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [patients, setPatients] = useState<Record<string, PatientData>>({});
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ws = useRef<WebSocket | null>(null);

  // Цвета для графиков в зависимости от темы
  const getChartColors = () => {
    return currentTheme === 'dark'
      ? {
        gridStroke: token.colorBorderSecondary,
        textColor: token.colorText,
        tooltipBg: token.colorBgElevated,
        tooltipBorder: token.colorBorder,
        systolic: '#8884d8',
        diastolic: '#82ca9d',
        pulse: '#ff7300',
        sugar: '#ff0000'
      }
      : {
        gridStroke: token.colorBorderSecondary,
        textColor: token.colorText,
        tooltipBg: token.colorBgElevated,
        tooltipBorder: token.colorBorder,
        systolic: '#8884d8',
        diastolic: '#82ca9d',
        pulse: '#ff7300',
        sugar: '#ff0000'
      };
  };

  const chartColors = getChartColors();

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    setLoading(true);
    ws.current = new WebSocket('ws://localhost:3000');

    ws.current.onopen = () => {
      setConnectionStatus('connected');
      setLoading(false);
      ws.current?.send(JSON.stringify({ type: "monitor_init" }));
    };

    ws.current.onclose = () => {
      setConnectionStatus('disconnected');
      setTimeout(() => connectWebSocket(), 5000);
    };

    ws.current.onerror = () => {
      setConnectionStatus('error');
      setLoading(false);
    };

    ws.current.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (e) {
        console.error("Ошибка обработки сообщения:", e);
      }
    };
  };

  const handleWebSocketMessage = (data: WebSocketMessage) => {
    if (data.status === "connected") return;
    if (data.status === "error") return console.error("Ошибка:", data.error);

    // Changed from data.clientId to data.patientId to match Unity client
    if (data.type === "medical_data" && data.patientId) {
      updatePatientData(data);
      usePatientStore.getState().updatePatients({
        ...patients,
        [data.patientId]: {
          ...patients[data.patientId],
          ...data
        }
      });
    }

    // Changed from data.clientId to data.patientId
    if (data.type === "patient_disconnected" && data.patientId) {
      handlePatientDisconnected(data.patientId);
      const newPatients = { ...patients };
      delete newPatients[data.patientId];
      usePatientStore.getState().updatePatients(newPatients);
    }
  };

  const updatePatientData = (data: WebSocketMessage) => {
    const now = new Date().toISOString();
    const newDataPoint = {
      timestamp: now,
      pressure: data.pressure || { systolic: 0, diastolic: 0 },
      bloodSugar: data.bloodSugar || 0,
      pulse: data.pulse || 0
    };

    setPatients(prevPatients => {
      // Changed from data.clientId to data.patientId
      const existingPatient = prevPatients[data.patientId!] || {
        patientId: data.patientId!, // Changed from clientId to patientId
        history: []
      };

      const updatedHistory = [...(existingPatient.history || []), newDataPoint].slice(-20);

      const updatedPatient = {
        ...existingPatient,
        pressure: data.pressure || existingPatient.pressure,
        bloodSugar: data.bloodSugar ?? existingPatient.bloodSugar,
        pulse: data.pulse ?? existingPatient.pulse,
        lastUpdate: now,
        disconnected: false,
        history: updatedHistory
      };

      // Changed from data.clientId to data.patientId
      usePatientStore.getState().updatePatients({
        ...prevPatients,
        [data.patientId!]: updatedPatient
      });

      return {
        ...prevPatients,
        [data.patientId!]: updatedPatient
      };
    });
  };

  const handlePatientDisconnected = (patientId: string) => {
    setPatients(prevPatients => ({
      ...prevPatients,
      [patientId]: {
        ...prevPatients[patientId],
        disconnected: true
      }
    }));

    setTimeout(() => {
      setPatients(prevPatients => {
        const newPatients = { ...prevPatients };
        delete newPatients[patientId];
        if (selectedPatient === patientId) setSelectedPatient(null);
        return newPatients;
      });
    }, 5000);
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return "Подключено к серверу мониторинга";
      case 'disconnected': return "Отключено от сервера. Попытка переподключения...";
      case 'error': return "Ошибка соединения";
      default: return "Статус соединения неизвестен";
    }
  };

  const selectedPatientData = selectedPatient ? patients[selectedPatient] : null;

  return (
    <Spin spinning={loading} size="large">
      <div className="patient-monitoring-container"
           style={{
             backgroundColor: token.colorBgContainer,
             color: token.colorText
           }}>
        <div className="monitoring-header"
             style={{
               backgroundColor: token.colorBgElevated,
               borderBottom: `1px solid ${token.colorBorder}`
             }}>
          <h1 style={{ color: token.colorText }}>Мониторинг пациентов</h1>
          <div className="status"
               style={{
                 backgroundColor: token.colorBgLayout,
                 color: connectionStatus === 'connected'
                   ? token.colorSuccess
                   : token.colorError,
                 border: `1px solid ${token.colorBorder}`
               }}>
            {getStatusText()}
          </div>
        </div>

        <div className="monitoring-content">
          <div className="patients-list-container"
               style={{
                 backgroundColor: token.colorBgElevated,
                 borderRight: `1px solid ${token.colorBorder}`
               }}>
            <h2 style={{ color: token.colorText, padding: '0 16px' }}>Список пациентов</h2>
            <div className="patients-list-scroll">
              {Object.values(patients).map(patient => (
                <div
                  key={patient.patientId}
                  className="patient-card"
                  style={{
                    backgroundColor: token.colorBgContainer,
                    borderLeft: `4px solid ${patient.disconnected ? token.colorError : token.colorSuccess}`,
                    border: selectedPatient === patient.patientId
                      ? `2px solid ${token.colorPrimary}`
                      : `1px solid ${token.colorBorder}`,
                    margin: '8px 16px'
                  }}
                  onClick={() => setSelectedPatient(patient.patientId)}
                >
                  <h3 style={{ color: token.colorText }}>Пациент ID: {patient.patientId}</h3>
                  <div className="patient-summary" style={{ color: token.colorTextSecondary }}>
                    <div>Давление: {patient.pressure ? `${patient.pressure.systolic}/${patient.pressure.diastolic}` : '--/--'}</div>
                    <div>Пульс: {patient.pulse || '--'} bpm</div>
                    <div>Сахар: {patient.bloodSugar || '--'} mmol/L</div>
                    <div>Последнее обновление: {patient.lastUpdate || '--'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="patient-details-container">
            {selectedPatientData ? (
              <>
                <div className="patient-details-header"
                     style={{
                       backgroundColor: token.colorBgElevated,
                       borderBottom: `1px solid ${token.colorBorder}`
                     }}>
                  <h2 style={{ color: token.colorText }}>Детали пациента {selectedPatient}</h2>

                  <div className="current-data">
                    <h3 style={{ color: token.colorText }}>Текущие показатели</h3>
                    <div className="data-grid">
                      <div className="data-item"
                           style={{
                             backgroundColor: token.colorFillAlter,
                             border: `1px solid ${token.colorBorder}`
                           }}>
                        <label style={{ color: token.colorText }}>Давление:</label>
                        <span style={{ color: token.colorText }}>
                          {selectedPatientData.pressure ?
                            `${selectedPatientData.pressure.systolic}/${selectedPatientData.pressure.diastolic} mmHg` : '--/--'}
                        </span>
                      </div>
                      <div className="data-item"
                           style={{
                             backgroundColor: token.colorFillAlter,
                             border: `1px solid ${token.colorBorder}`
                           }}>
                        <label style={{ color: token.colorText }}>Сахар в крови:</label>
                        <span style={{ color: token.colorText }}>
                          {selectedPatientData.bloodSugar !== undefined ?
                            `${selectedPatientData.bloodSugar} mmol/L` : '--'}
                        </span>
                      </div>
                      <div className="data-item"
                           style={{
                             backgroundColor: token.colorFillAlter,
                             border: `1px solid ${token.colorBorder}`
                           }}>
                        <label style={{ color: token.colorText }}>Пульс:</label>
                        <span style={{ color: token.colorText }}>
                          {selectedPatientData.pulse !== undefined ?
                            `${selectedPatientData.pulse} bpm` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="charts-scroll-container">
                  <div className="chart-container"
                       style={{
                         backgroundColor: token.colorBgElevated,
                         boxShadow: token.boxShadow
                       }}>
                    <h4 style={{ color: token.colorText }}>Артериальное давление</h4>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: chartColors.textColor }}
                          />
                          <YAxis
                            label={{
                              value: 'mmHg',
                              angle: -90,
                              position: 'insideLeft',
                              fill: chartColors.textColor
                            }}
                            tick={{ fill: chartColors.textColor }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartColors.tooltipBg,
                              borderColor: chartColors.tooltipBorder,
                              color: token.colorText
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="pressure.systolic"
                            stroke={chartColors.systolic}
                            name="Систолическое"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="pressure.diastolic"
                            stroke={chartColors.diastolic}
                            name="Диастолическое"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="chart-container"
                       style={{
                         backgroundColor: token.colorBgElevated,
                         boxShadow: token.boxShadow
                       }}>
                    <h4 style={{ color: token.colorText }}>Пульс</h4>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: chartColors.textColor }}
                          />
                          <YAxis
                            label={{
                              value: 'уд/мин',
                              angle: -90,
                              position: 'insideLeft',
                              fill: chartColors.textColor
                            }}
                            tick={{ fill: chartColors.textColor }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartColors.tooltipBg,
                              borderColor: chartColors.tooltipBorder,
                              color: token.colorText
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="pulse"
                            fill={chartColors.pulse}
                            name="Пульс"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="chart-container"
                       style={{
                         backgroundColor: token.colorBgElevated,
                         boxShadow: token.boxShadow
                       }}>
                    <h4 style={{ color: token.colorText }}>Уровень сахара в крови</h4>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: chartColors.textColor }}
                          />
                          <YAxis
                            label={{
                              value: 'ммоль/л',
                              angle: -90,
                              position: 'insideLeft',
                              fill: chartColors.textColor
                            }}
                            tick={{ fill: chartColors.textColor }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartColors.tooltipBg,
                              borderColor: chartColors.tooltipBorder,
                              color: token.colorText
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="bloodSugar"
                            stroke={chartColors.sugar}
                            name="Сахар"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-patient-selected" style={{ color: token.colorTextSecondary }}>
                <p>Выберите пациента для просмотра детальной информации</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Spin>
  );
};

export default PatientMonitoring;
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
import useAppStore from '@/stores/app.ts';
import usePatientStore from '@/stores/patientStore.ts';

const { useToken } = theme;

// Интерфейсы и типы остаются без изменений

const PatientMonitoring: React.FC = () => {
  const { token } = useToken();
  const { theme: currentTheme } = useAppStore();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [ward, setWard] = useState<WardPatient>({});
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ws = useRef<WebSocket | null>(null);
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

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
      Object.values(timersRef.current).forEach(timer => clearTimeout(timer));
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
      const data = JSON.parse(event.data) as WebSocketMessage;
      const patientId = data.patientId || data.clientId;
      if (!patientId) return;

      const wardNumber = data.wardNumber || 101;

      if (data.type === "medical_data") {
        const now = new Date().toISOString();
        const newDataPoint = {
          timestamp: data.timestamp || now,
          pressure: data.pressure || { systolic: 0, diastolic: 0 },
          bloodSugar: data.bloodSugar || 0,
          pulse: data.pulse || 0
        };

        setWard(prevWard => {
          const newWard = { ...prevWard };
          const wardPatients = newWard[wardNumber] || [];

          const existingPatientIndex = wardPatients.findIndex(p => p.patientId === patientId);

          if (existingPatientIndex >= 0) {
            const existingPatient = wardPatients[existingPatientIndex];
            const updatedHistory = [...(existingPatient.history || []), newDataPoint].slice(-20);

            wardPatients[existingPatientIndex] = {
              ...existingPatient,
              ...data,
              lastUpdate: now,
              history: updatedHistory,
              disconnected: false
            };
          } else {
            wardPatients.push({
              patientId,
              firstName: data.firstName,
              lastName: data.lastName,
              wardNumber,
              diagnosis: data.diagnosis,
              lastUpdate: now,
              history: [newDataPoint],
              disconnected: false,
              ...data
            });
          }

          newWard[wardNumber] = wardPatients;

          if (timersRef.current[patientId]) {
            clearTimeout(timersRef.current[patientId]);
            delete timersRef.current[patientId];
          }

          return newWard;
        });
      }

      if (data.type === "patient_disconnected") {
        setWard(prevWard => {
          const newWard = { ...prevWard };
          const wardPatients = newWard[wardNumber] || [];

          const updatedPatients = wardPatients.map(patient =>
            patient.patientId === patientId
              ? { ...patient, disconnected: true }
              : patient
          );

          newWard[wardNumber] = updatedPatients;

          if (timersRef.current[patientId]) {
            clearTimeout(timersRef.current[patientId]);
          }

          timersRef.current[patientId] = setTimeout(() => {
            setWard(prev => {
              const updatedWard = { ...prev };
              updatedWard[wardNumber] = (updatedWard[wardNumber] || []).filter(
                p => p.patientId !== patientId
              );

              // Удаляем палату, если она пуста
              if (updatedWard[wardNumber].length === 0) {
                delete updatedWard[wardNumber];
              }

              return updatedWard;
            });
            delete timersRef.current[patientId];
          }, 5000);

          return newWard;
        });
      }
    };
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return "Подключено к серверу мониторинга";
      case 'disconnected': return "Отключено от сервера. Попытка переподключения...";
      case 'error': return "Ошибка соединения";
      default: return "Статус соединения неизвестен";
    }
  };

  const getSelectedPatientData = () => {
    if (!selectedPatient) return null;

    for (const wardNumber in ward) {
      const patient = ward[wardNumber].find(p => p.patientId === selectedPatient);
      if (patient) return patient;
    }
    return null;
  };

  const selectedPatientData = getSelectedPatientData();

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
            <h2 style={{ color: token.colorText, padding: '0 16px' }}>Палаты</h2>
            <div className="ward-scroll">
              {Object.entries(ward).sort(([a], [b]) => Number(a) - Number(b)).map(([wardNumber, patients]) => (
                <div key={wardNumber} className="ward-section">
                  <h3 style={{
                    color: token.colorText,
                    padding: '8px 16px',
                    backgroundColor: token.colorFillSecondary,
                    margin: 0
                  }}>
                    Палата {wardNumber}
                  </h3>
                  <div className="patient-list">
                    {patients.map(patient => (
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
                        <h3 style={{ color: token.colorText }}>
                          {patient.lastName} {patient.firstName}
                        </h3>
                        <div style={{ color: token.colorTextSecondary }}>
                          Диагноз: {patient.diagnosis || '--'}
                        </div>
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
              ))}
            </div>
          </div>

          <div className="patient-details-container">
            {selectedPatientData ? (
              <>
                <div className="patient-detail-header"
                     style={{
                       backgroundColor: token.colorBgElevated,
                       borderBottom: `1px solid ${token.colorBorder}`
                     }}>
                  <h2 style={{ color: token.colorText }}>
                    {selectedPatientData.lastName} {selectedPatientData.firstName}
                  </h2>
                  <div style={{ color: token.colorTextSecondary }}>
                    Палата: {selectedPatientData.wardNumber || '--'},
                    Диагноз: {selectedPatientData.diagnosis || '--'}
                  </div>

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

                <div className="chart-scroll-container">
                  <div className="chart-container"
                       style={{
                         backgroundColor: token.colorBgElevated,
                         boxShadow: token.boxShadow
                       }}>
                    <h4 style={{ color: token.colorText }}>Артериальное давление</h4>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDash="3 3" stroke={chartColors.gridStroke} />
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
                          <CartesianGrid strokeDash="3 3" stroke={chartColors.gridStroke} />
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
                          <CartesianGrid strokeDash="3 3" stroke={chartColors.gridStroke} />
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
                <p>Выберите пациент для просмотра детальной информации</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Spin>
  );
};

export default PatientMonitoring;

import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { theme, notification } from 'antd';
import { Spin } from 'antd';
import './PatientMonitoring.css';
import useAppStore from '@/stores/app.ts';
import usePatientStore from '@/stores/patientStore.ts';

const { useToken } = theme;

interface Pressure {
  systolic: number;
  diastolic: number;
}

interface HistoryItem {
  timestamp: string;
  pressure: Pressure;
  bloodSugar: number;
  pulse: number;
}

interface Patient {
  patientId: string;
  firstName: string;
  lastName: string;
  wardNumber: number;
  diagnosis?: string;
  pressure?: Pressure;
  bloodSugar?: number;
  pulse?: number;
  lastUpdate?: string;
  history: HistoryItem[];
  disconnected?: boolean;
}

interface WardPatient {
  [wardNumber: string]: Patient[];
}

interface WebSocketMessage {
  type: string;
  patientId?: string;
  clientId?: string;
  wardNumber?: number;
  firstName?: string;
  lastName?: string;
  diagnosis?: string;
  pressure?: Pressure;
  bloodSugar?: number;
  pulse?: number;
  timestamp?: string;
}

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

  const removePatientFromWard = (patientId: string, wardNumber: string) => {
    setWard(prevWard => {
      const newWard = { ...prevWard };
      if (!newWard[wardNumber]) return prevWard;

      newWard[wardNumber] = newWard[wardNumber].filter(p => p.patientId !== patientId);

      if (newWard[wardNumber].length === 0) {
        delete newWard[wardNumber];
      }

      return newWard;
    });
  };

  const handlePatientDisconnected = (data: WebSocketMessage) => {
    const patientId = data.patientId || data.clientId;
    if (!patientId) return;

    // Получаем актуальный номер палаты из текущего состояния
    let actualWardNumber = '101';
    for (const wardNum in ward) {
      if (ward[wardNum].some(p => p.patientId === patientId)) {
        actualWardNumber = wardNum;
        break;
      }
    }

    notification.warning({
      message: `Пациент отключается`,
      description: `Пациент ${patientId} будет удален через 5 секунд`,
      duration: 3
    });

    // Помечаем пациента как отключенного
    setWard(prevWard => {
      const newWard = { ...prevWard };
      if (!newWard[actualWardNumber]) {
        console.error(`Ward ${actualWardNumber} not found for patient ${patientId}`);
        return prevWard;
      }

      newWard[actualWardNumber] = newWard[actualWardNumber].map(patient =>
        patient.patientId === patientId
          ? { ...patient, disconnected: true }
          : patient
      );

      return newWard;
    });

    // Устанавливаем таймер на удаление
    if (timersRef.current[patientId]) {
      clearTimeout(timersRef.current[patientId]);
    }

    timersRef.current[patientId] = setTimeout(() => {
      setWard(prevWard => {
        // Создаем полную копию состояния
        const newWard = { ...prevWard };

        // Ищем палату, где находится пациент
        let wardToUpdate = actualWardNumber;
        if (!newWard[wardToUpdate]) {
          // Если в указанной палате нет, ищем в других
          for (const wardNum in newWard) {
            if (newWard[wardNum].some(p => p.patientId === patientId)) {
              wardToUpdate = wardNum;
              break;
            }
          }
        }

        if (!newWard[wardToUpdate]) {
          console.error(`Patient ${patientId} not found in any ward`);
          return prevWard;
        }

        // Фильтруем пациентов
        newWard[wardToUpdate] = newWard[wardToUpdate].filter(
          p => p.patientId !== patientId
        );

        // Если палата пуста - удаляем
        if (newWard[wardToUpdate].length === 0) {
          delete newWard[wardToUpdate];
        }

        return newWard;
      });

      // Сбрасываем выбор если это выбранный пациент
      setSelectedPatient(prev => prev === patientId ? null : prev);

      delete timersRef.current[patientId];
    }, 5000);
  };

  const connectWebSocket = () => {
    setLoading(true);
    ws.current = new WebSocket('wss://decadances.store/ws/');

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

      const wardNumber = data.wardNumber ? data.wardNumber.toString() : '101';

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
            const updatedHistory = [...(existingPatient.history || []), newDataPoint].slice(-50);

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
              firstName: data.firstName || 'Unknown',
              lastName: data.lastName || 'Patient',
              wardNumber: Number(wardNumber),
              diagnosis: data.diagnosis || 'No diagnosis',
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
      } else if (data.type === "patient_disconnected") {
        handlePatientDisconnected(data);
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

                <div className="chart-scroll-container"
                     style={{
                       height: 'calc(100vh - 300px)',
                       overflowY: 'auto',
                       paddingRight: '8px'
                     }}>
                  <div className="chart-container"
                       style={{
                         backgroundColor: token.colorBgElevated,
                         boxShadow: token.boxShadow,
                         height: '350px',
                         marginBottom: '24px'
                       }}>
                    <h4 style={{ color: token.colorText }}>Артериальное давление</h4>
                    <div className="chart-wrapper" style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDash="3 3" stroke={chartColors.gridStroke} />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: chartColors.textColor, angle: -45, fontSize: 12 }}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return `${date.getHours()}:${date.getMinutes()}`;
                            }}
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
                         boxShadow: token.boxShadow,
                         height: '350px',
                         marginBottom: '24px'
                       }}>
                    <h4 style={{ color: token.colorText }}>Пульс</h4>
                    <div className="chart-wrapper" style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDash="3 3" stroke={chartColors.gridStroke} />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: chartColors.textColor, angle: -45, fontSize: 12 }}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return `${date.getHours()}:${date.getMinutes()}`;
                            }}
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
                         boxShadow: token.boxShadow,
                         height: '350px',
                         marginBottom: '24px'
                       }}>
                    <h4 style={{ color: token.colorText }}>Уровень сахара в крови</h4>
                    <div className="chart-wrapper" style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedPatientData.history}>
                          <CartesianGrid strokeDash="3 3" stroke={chartColors.gridStroke} />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: chartColors.textColor, angle: -45, fontSize: 12 }}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return `${date.getHours()}:${date.getMinutes()}`;
                            }}
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
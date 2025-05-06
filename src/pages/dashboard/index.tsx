import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, theme, Spin, Empty, Tag, notification } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import Chart from './chart';
import './Dashboard.css';

const { useToken } = theme;

interface PatientData {
  patientId: string;
  pressure?: {
    systolic: number;
    diastolic: number;
  };
  bloodSugar?: number;
  pulse?: number;
  lastUpdate?: string;
  disconnected?: boolean;
}

const Dashboard: React.FC = () => {
  const { token } = useToken();
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [patients, setPatients] = useState<Record<string, PatientData>>({});
  const [loading, setLoading] = useState(true);

  // Статистика, вычисляемая на основе patients
  const activePatients = Object.values(patients).filter(p => !p.disconnected);
  const totalPatients = activePatients.length;
  const newToday = 0;
  const criticalCases = activePatients.filter(p =>
    (p.pulse && (p.pulse > 120 || p.pulse < 50)) ||
    (p.bloodSugar !== undefined && (p.bloodSugar > 10 || p.bloodSugar < 3.5)) ||
    (p.pressure && (p.pressure.systolic > 140 || p.pressure.diastolic > 90))
  ).length;

  const averagePulse = activePatients.reduce((acc, p) => acc + (p.pulse || 0), 0) / totalPatients || 0;

  const [changes] = useState({
    total: 0,
    new: 0,
    critical: 0,
    pulse: 0
  });

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
      setSocketStatus('connected');
      setLoading(false);
      console.log('WebSocket connected');
      socket.send(JSON.stringify({
        type: "monitor_init",
        clientType: "dashboard"
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Dashboard received:', data);

        // Обработка медицинских данных
        if (data.type === "medical_data" && (data.patientId || data.clientId)) {
          const patientId = data.patientId || data.clientId; // Поддержка обоих полей
          setPatients(prev => ({
            ...prev,
            [patientId]: {
              ...prev[patientId],
              ...data,
              patientId, // Убедимся, что patientId установлен
              lastUpdate: new Date().toISOString(),
              disconnected: false
            }
          }));
        }

        // Обработка отключения пациента
        if (data.type === "patient_disconnected" && (data.patientId || data.clientId)) {
          const patientId = data.patientId || data.clientId; // Поддержка обоих полей

          // Показываем уведомление
          notification.warning({
            message: `Пациент ${patientId} отключается`,
            description: 'Пациент будет удален через 5 секунд',
            duration: 3
          });

          // Сначала помечаем пациента как отключенного
          setPatients(prev => {
            if (!prev[patientId]) return prev;

            return {
              ...prev,
              [patientId]: {
                ...prev[patientId],
                disconnected: true
              }
            };
          });

          // Затем удаляем через 5 секунд
          setTimeout(() => {
            setPatients(prev => {
              if (!prev[patientId]) return prev;

              const { [patientId]: _, ...rest } = prev;
              console.log(`Patient ${patientId} removed from dashboard`);
              return rest;
            });
          }, 5000);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setSocketStatus('disconnected');
      setLoading(false);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setSocketStatus('disconnected');
      setLoading(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const statsData = [
    { title: 'Всего пациентов', value: totalPatients, change: changes.total },
    { title: 'Новых сегодня', value: newToday, change: changes.new },
    { title: 'Критических случаев', value: criticalCases, change: changes.critical },
    { title: 'Средний пульс', value: Math.round(averagePulse), change: changes.pulse }
  ];

  const chartData = activePatients.map(patient => ({
    name: patient.patientId,
    pulse: patient.pulse,
    pressure: patient.pressure ? (patient.pressure.systolic + patient.pressure.diastolic) / 2 : 0,
    sugar: patient.bloodSugar
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin tip="Загрузка данных..." size="large" />
      </div>
    );
  }

  if (activePatients.length === 0) {
    return <Empty description="Нет активных пациентов" />;
  }

  return (
    <div className="dashboard-container">
      <Card className="dashboard-card">
        <div className="page-header">
          <h1 style={{ color: token.colorText }}>Медицинский мониторинг</h1>
          <p style={{ color: token.colorTextSecondary }}>
            Обзор показателей пациентов в реальном времени
            <span style={{
              marginLeft: '10px',
              color: socketStatus === 'connected' ? token.colorSuccess : token.colorError,
              fontSize: '0.8em'
            }}>
              {socketStatus === 'connected' ? '✓ Online' : '✗ Offline'}
            </span>
          </p>
        </div>

        <div className="dashboard-content">
          <Row gutter={[16, 16]} className="stats-row">
            {statsData.map((stat, index) => (
              <Col xs={24} sm={12} md={6} key={index}>
                <Card bordered={false} style={{ backgroundColor: token.colorBgElevated }}>
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    valueStyle={{ color: token.colorText }}
                    prefix={
                      stat.change > 0 ? (
                        <ArrowUpOutlined style={{ color: token.colorSuccess }} />
                      ) : stat.change < 0 ? (
                        <ArrowDownOutlined style={{ color: token.colorError }} />
                      ) : null
                    }
                    suffix={stat.change !== 0 && (
                      <span style={{
                        color: stat.change > 0 ? token.colorSuccess : token.colorError,
                        fontSize: 14
                      }}>
                        {Math.abs(stat.change)}%
                      </span>
                    )}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <div className="scrollable-content">
            <Card
              title="Динамика показателей"
              bordered={false}
              className="chart-card"
              extra={<span style={{
                color: socketStatus === 'connected' ? token.colorSuccess : token.colorError
              }}>
                {socketStatus === 'connected' ? 'Live' : 'Offline'}
              </span>}
            >
              <div className="chart-container">
                <Chart data={chartData} />
              </div>
            </Card>

            <Row gutter={[16, 16]} className="bottom-cards-row">
              <Col xs={24} md={12}>
                <Card
                  title="Последние измерения"
                  bordered={false}
                  className="table-card"
                >
                  <div className="patient-measurements">
                    {Object.values(patients).slice(0, 5).map(patient => (
                      <div key={patient.patientId} className="measurement-item"
                           style={{
                             borderBottom: `1px solid ${token.colorBorder}`,
                             opacity: patient.disconnected ? 0.6 : 1
                           }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <h4 style={{ color: token.colorText }}>Пациент {patient.patientId}</h4>
                          {patient.disconnected && (
                            <Tag color="red">Отключен</Tag>
                          )}
                        </div>
                        <div style={{ color: token.colorTextSecondary }}>
                          <p>Давление: {patient.pressure ?
                            `${patient.pressure.systolic}/${patient.pressure.diastolic}` : '--/--'}</p>
                          <p>Пульс: {patient.pulse || '--'} bpm</p>
                          <p>Сахар в крови: {patient.bloodSugar !== undefined ?
                            `${patient.bloodSugar} mmol/L` : '--'}</p>
                          <p>Последнее обновление: {formatDate(patient.lastUpdate)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card
                  title="Активные тревоги"
                  bordered={false}
                  className="alerts-card"
                >
                  <div className="alerts-list">
                    {Object.values(patients)
                      .filter(patient =>
                        (patient.pulse && (patient.pulse > 120 || patient.pulse < 50)) ||
                        (patient.bloodSugar !== undefined && (patient.bloodSugar > 10 || patient.bloodSugar < 3.5)) ||
                        (patient.pressure && (patient.pressure.systolic > 140 || patient.pressure.diastolic > 90))
                      )
                      .map(patient => (
                        <div key={patient.patientId} className="alert-item"
                             style={{
                               color: token.colorError,
                               marginBottom: 8,
                               backgroundColor: token.colorErrorBg,
                               padding: 8,
                               borderRadius: 4,
                               opacity: patient.disconnected ? 0.7 : 1
                             }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Пациент {patient.patientId}</strong>
                            {patient.disconnected && (
                              <Tag color="red">Отключен</Tag>
                            )}
                          </div>
                          {patient.pulse && (patient.pulse > 120 || patient.pulse < 50) &&
                            <div>⚠️ Аномальный пульс: {patient.pulse} bpm (норма: 50-120)</div>}
                          {patient.bloodSugar !== undefined && (patient.bloodSugar > 10 || patient.bloodSugar < 3.5) &&
                            <div>⚠️ Аномальный сахар: {patient.bloodSugar} mmol/L (норма: 3.5-10)</div>}
                          {patient.pressure && (patient.pressure.systolic > 140 || patient.pressure.diastolic > 90) &&
                            <div>⚠️ Аномальное давление: {patient.pressure.systolic}/{patient.pressure.diastolic} mmHg</div>}
                          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            Обновлено: {formatDate(patient.lastUpdate)}
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
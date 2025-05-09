import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, DatePicker, message, Popconfirm } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const PatientsPage = () => {
  const [data, setData] = useState([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

  const fetchPatients = () => {
    axios.get('http://82.202.130.86:8001/api/patients')
      .then(res => setData(res.data))
      .catch(err => console.error('Ошибка загрузки пациентов:', err));
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleEdit = (patient: any) => {
    setEditingPatient(patient);
    form.setFieldsValue({
      ...patient,
      dob: patient.dob ? dayjs(patient.dob) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`http://82.202.130.86:8001/api/patients/${id}`);
    message.success('Пациент удален');
    fetchPatients();
  };

  const handleFinish = async (values: any) => {
    const payload = {
      ...values,
      dob: values.dob ? values.dob.format('YYYY-MM-DD') : null,
    };

    try {
      let response;
      if (editingPatient) {
        // @ts-ignore
        response = await axios.put(`http://82.202.130.86:8001/api/patients/${editingPatient.id}`, payload);
        message.success('Пациент обновлен');
      } else {
        response = await axios.post('http://82.202.130.86:8001/api/patients', payload);
        message.success(`Пациент добавлен. Код приглашения: ${response.data.invitation_code}`);
      }

      setModalVisible(false);
      form.resetFields();
      setEditingPatient(null);
      fetchPatients();
    } catch (error) {
      message.error('Ошибка при сохранении пациента');
      console.error(error);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    {
      title: 'ФИО',
      render: (_: any, row: any) => `${row.first_name} ${row.last_name}`,
    },
    { title: 'Дата рождения', dataIndex: 'dob' },
    { title: 'Код приглашения', dataIndex: 'invitation_code' },
    { title: 'Диагноз', dataIndex: 'diagnosis' },
    { title: 'Палата', dataIndex: 'ward_number' },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <>
          <Button type="link" onClick={() => handleEdit(record)}>Редактировать</Button>
          <Popconfirm title="Удалить пациента?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>Удалить</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <Card
      title="Пациенты"
      extra={
        <Button type="primary" onClick={() => {
          form.resetFields();
          setEditingPatient(null);
          setModalVisible(true);
        }}>
          Добавить пациента
        </Button>
      }
      style={{
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={{
        overflowX: 'auto',
        overflowY: 'auto',  // Добавляем вертикальную прокрутку
        width: '100%',
        maxHeight: '70vh',  // Ограничиваем высоту (можно настроить)
        maxWidth: 'calc(100vw - 32px)',
      }}>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          style={{ minWidth: '800px' }}
          scroll={{ x: 'max-content', y: 'calc(70vh - 100px)' }}  // Прокрутка внутри таблицы
          pagination={{ pageSize: 10 }}  // Добавляем пагинацию (опционально)
        />
      </div>

      <Modal
        title={editingPatient ? "Редактировать пациента" : "Добавить пациента"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <Form.Item name="first_name" label="Имя" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Фамилия" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dob" label="Дата рождения">
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="diagnosis" label="Диагноз">
            <Input />
          </Form.Item>
          <Form.Item name="ward_number" label="Палата">
            <Input />
          </Form.Item>
          <Form.Item name="department" label="Отделение">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default PatientsPage;
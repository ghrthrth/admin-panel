// patients.tsx
import { Card, Table } from 'antd';

const PatientsPage = () => {

  const data = [
    { id: 1, name: 'Иванов Иван', diagnosis: 'ОРВИ' },
    { id: 2, name: 'Петрова Мария', diagnosis: 'Гипертония' },
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'ФИО', dataIndex: 'name' },
    { title: 'Диагноз', dataIndex: 'diagnosis' },
  ];

  return (
    <Card>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
      />
    </Card>
  );
};

export default PatientsPage;
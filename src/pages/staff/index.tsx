import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Card, Typography, Select, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import './index.scss';
import { useLocale } from '@/locales';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Option } = Select;

interface MedicalStaff {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'doctor' | 'nurse' | 'admin';
  specialization?: string;
  department?: string;
  created_at?: string;
}

const API_URL = 'http://82.202.130.86:8001/api/staff';

const StaffPage = () => {
  const { formatMessage } = useLocale();
  const [staffData, setStaffData] = useState<MedicalStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<MedicalStaff | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL);
      setStaffData(response.data);
    } catch (err) {
      console.error('API error:', err);
      message.error(formatMessage({ id: 'staff.notification.fetch.error' }));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingStaff(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: MedicalStaff) => {
    setEditingStaff(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      message.success(formatMessage({ id: 'staff.notification.delete.success' }));
      fetchStaff();
    } catch (err) {
      message.error(formatMessage({ id: 'staff.notification.delete.error' }));
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingStaff) {
        await axios.put(`${API_URL}/${editingStaff.id}`, values);
        message.success(formatMessage({ id: 'staff.notification.update.success' }));
      } else {
        await axios.post(API_URL, values);
        message.success(formatMessage({ id: 'staff.notification.add.success' }));
      }

      setIsModalVisible(false);
      fetchStaff();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredStaff = staffData.filter(staff =>
    staff.first_name.toLowerCase().includes(searchText.toLowerCase()) ||
    staff.last_name.toLowerCase().includes(searchText.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchText.toLowerCase())
  );

  const roleColors = {
    doctor: 'blue',
    nurse: 'green',
    admin: 'red'
  };

  const columns: ColumnsType<MedicalStaff> = [
    {
      title: formatMessage({ id: 'staff.columns.id' }),
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: formatMessage({ id: 'staff.columns.firstName' }),
      dataIndex: 'first_name',
      key: 'first_name',
      sorter: (a, b) => a.first_name.localeCompare(b.first_name),
    },
    {
      title: formatMessage({ id: 'staff.columns.lastName' }),
      dataIndex: 'last_name',
      key: 'last_name',
      sorter: (a, b) => a.last_name.localeCompare(b.last_name),
    },
    {
      title: formatMessage({ id: 'staff.columns.email' }),
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: formatMessage({ id: 'staff.columns.role' }),
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={roleColors[role as keyof typeof roleColors]}>
          {formatMessage({ id: `staff.roles.${role}` })}
        </Tag>
      ),
      filters: [
        { text: formatMessage({ id: 'staff.roles.doctor' }), value: 'doctor' },
        { text: formatMessage({ id: 'staff.roles.nurse' }), value: 'nurse' },
        { text: formatMessage({ id: 'staff.roles.admin' }), value: 'admin' },
      ],
      onFilter: (value: React.Key | boolean, record: MedicalStaff) => {
        // Приводим value к строке, так как наши значения фильтров - строки
        return record.role === String(value);
      },
    },
    {
      title: formatMessage({ id: 'staff.columns.specialization' }),
      dataIndex: 'specialization',
      key: 'specialization',
      render: (text: string) => text || 'N/A',
    },
    {
      title: formatMessage({ id: 'staff.columns.department' }),
      dataIndex: 'department',
      key: 'department',
      render: (text: string) => text || 'N/A',
    },
    {
      title: formatMessage({ id: 'staff.columns.createdAt' }),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime(),
    },
    {
      title: formatMessage({ id: 'staff.columns.actions' }),
      key: 'actions',
      render: (_: any, record: MedicalStaff) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={formatMessage({ id: 'staff.popconfirm.delete.title' })}
            onConfirm={() => handleDelete(record.id)}
            okText={formatMessage({ id: 'staff.popconfirm.delete.ok' })}
            cancelText={formatMessage({ id: 'staff.popconfirm.delete.cancel' })}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="staff-page-container">
      <Card>
        <div className="page-header">
          <Title level={3}>{formatMessage({ id: 'staff.title' })}</Title>
          <Space>
            <Input
              placeholder={formatMessage({ id: 'staff.search.placeholder' })}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              {formatMessage({ id: 'staff.actions.add' })}
            </Button>
          </Space>
        </div>

        <Table<MedicalStaff>
          columns={columns}
          dataSource={filteredStaff}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 11 }}
          scroll={{ x: 'max-content', y: 'calc(105vh - 255px)' }}
          locale={{
            emptyText: loading ? formatMessage({ id: 'staff.loading' }) : formatMessage({ id: 'staff.noData' })
          }}
        />

        <Modal
          title={editingStaff
            ? formatMessage({ id: 'staff.modal.edit.title' })
            : formatMessage({ id: 'staff.modal.add.title' })}
          open={isModalVisible}
          onOk={handleSubmit}
          onCancel={() => setIsModalVisible(false)}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="first_name"
              label={formatMessage({ id: 'staff.modal.firstName.label' })}
              rules={[{
                required: true,
                message: formatMessage({ id: 'staff.modal.firstName.required' })
              }]}
            >
              <Input placeholder={formatMessage({ id: 'staff.modal.firstName.placeholder' })} />
            </Form.Item>
            <Form.Item
              name="last_name"
              label={formatMessage({ id: 'staff.modal.lastName.label' })}
              rules={[{
                required: true,
                message: formatMessage({ id: 'staff.modal.lastName.required' })
              }]}
            >
              <Input placeholder={formatMessage({ id: 'staff.modal.lastName.placeholder' })} />
            </Form.Item>
            <Form.Item
              name="email"
              label={formatMessage({ id: 'staff.modal.email.label' })}
              rules={[{
                required: true,
                type: 'email',
                message: formatMessage({ id: 'staff.modal.email.required' })
              }]}
            >
              <Input placeholder={formatMessage({ id: 'staff.modal.email.placeholder' })} />
            </Form.Item>
            <Form.Item
              name="role"
              label={formatMessage({ id: 'staff.modal.role.label' })}
              rules={[{
                required: true,
                message: formatMessage({ id: 'staff.modal.role.required' })
              }]}
            >
              <Select placeholder={formatMessage({ id: 'staff.modal.role.placeholder' })}>
                <Option value="doctor">{formatMessage({ id: 'staff.roles.doctor' })}</Option>
                <Option value="nurse">{formatMessage({ id: 'staff.roles.nurse' })}</Option>
                <Option value="admin">{formatMessage({ id: 'staff.roles.admin' })}</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="specialization"
              label={formatMessage({ id: 'staff.modal.specialization.label' })}
            >
              <Input placeholder={formatMessage({ id: 'staff.modal.specialization.placeholder' })} />
            </Form.Item>
            <Form.Item
              name="department"
              label={formatMessage({ id: 'staff.modal.department.label' })}
            >
              <Input placeholder={formatMessage({ id: 'staff.modal.department.placeholder' })} />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default StaffPage;
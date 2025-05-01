import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { theme } from 'antd';
import useAppStore from '@/stores/app.ts';

const { useToken } = theme;

interface ChartProps {
  data: Array<{
    name: string;
    pulse?: number;
    pressure?: number;
    sugar?: number; // было bloodSugar
  }>;
}

const Chart = ({ data }: ChartProps) => {
  const { token } = useToken();
  const { theme: currentTheme } = useAppStore();

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={currentTheme === 'dark' ? token.colorBorderSecondary : '#f0f0f0'}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: token.colorText }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: token.colorText }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: token.colorText }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: token.colorBgElevated,
            borderColor: token.colorBorder,
            color: token.colorText
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="pulse"
          stroke="#8884d8"
          name="Пульс (уд/мин)"
          activeDot={{ r: 8 }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="pressure"
          stroke="#82ca9d"
          name="Сред. давление (mmHg)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="sugar" // было bloodSugar
          stroke="#ff7300"
          name="Сахар в крови (mmol/L)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Chart;
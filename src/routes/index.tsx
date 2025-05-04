import type { FC } from 'react'
import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate, useRoutes } from 'react-router-dom'
import Login from '../pages/login'
import LayoutPage from '../pages/layout'

const Dashboard = lazy(() => import('../pages/dashboard'))
const BarPage = lazy(() => import('../pages/charts/bar'))
const StaffPage = lazy(() => import('../pages/staff'))
const PacientsPage = lazy(() => import('../pages/pacients')) // Добавляем новый компонент
const ArticlePage = lazy(() => import('../pages/business/article'))
const JSONEditorPage = lazy(() => import('../pages/components-demo/json-editor'))
const NotFound = lazy(() => import('../pages/error/404'))
const NoPermission = lazy(() => import('../pages/error/403'))

const routeList: RouteObject[] = [
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <LayoutPage />,
    children: [
      {
        path: '',
        element: <Navigate to="dashboard" />,
      },
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/charts/bar',
        element: <BarPage />,
      },
      {
        path: '/business/article',
        element: <ArticlePage />,
      },
      {
        path: '/api/staff',
        element: <StaffPage />,
      },
      {
        path: '/pacients', // Добавляем новый роут
        element: <PacientsPage />,
      },
      {
        path: '/components/json-editor',
        element: <JSONEditorPage />,
      },
      {
        path: '/error/404',
        element: <NotFound />,
      },
      {
        path: '/error/403',
        element: <NoPermission />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]

const RenderRouter: FC = () => {
  return useRoutes(routeList)
}

export default RenderRouter
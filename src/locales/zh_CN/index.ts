import { user } from './user'
import { article } from './business/article'
import { tabBar } from './tabBar'
import { staff } from '@/locales/zh_CN/staff/staff.ts'

const zhCN = {
  ...user,
  ...article,
  ...tabBar,
  ...staff
}

export default zhCN

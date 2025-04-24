import { user } from './user'
import { article } from './business/article'
import { tabBar } from './tabBar'
import { staff } from '@/locales/ru_RU/staff/staff.ts'

const ruRU = {
  ...user,
  ...article,
  ...tabBar,
  ...staff,
}

export default ruRU

import dayjs from 'dayjs';

export { dayjs };

export const toIsoDate = (value: dayjs.ConfigType): string => dayjs(value).format('YYYY-MM-DD');
export const formatTime = (value: dayjs.ConfigType): string => dayjs(value).format('HH:mm');
export const formatDate = (value: dayjs.ConfigType): string => dayjs(value).format('MMM D');
export const formatMonthYear = (value: dayjs.ConfigType): string => dayjs(value).format('MMMM YYYY');
export const formatDateTime = (value: dayjs.ConfigType): string => dayjs(value).format('D/M/YYYY, HH:mm');
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

import dayjs from 'dayjs';

export { dayjs };

export const toIsoDate = (value: dayjs.ConfigType): string => dayjs(value).format('YYYY-MM-DD');
export const formatDateTime = (value: dayjs.ConfigType): string => dayjs(value).format('D/M/YYYY, HH:mm');

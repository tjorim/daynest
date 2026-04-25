import dayjs from 'dayjs';

export { dayjs };

export const toIsoDate = (value: dayjs.ConfigType): string => dayjs(value).format('YYYY-MM-DD');

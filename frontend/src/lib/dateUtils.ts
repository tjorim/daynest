import dayjs from 'dayjs';

export { dayjs };

export const toIsoDate = (value: Date): string => dayjs(value).format('YYYY-MM-DD');

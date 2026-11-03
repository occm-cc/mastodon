import type React from 'react';

import { useIntl } from 'react-intl';

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  const intl = useIntl();
  const formatted = intl.formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className='dm-date-separator'>
      <span className='dm-date-separator__text'>{formatted}</span>
    </div>
  );
};

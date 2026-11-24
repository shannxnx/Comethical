import { View } from 'react-native';

import { withAlpha } from '@/config/theme.config';
import { useCategory } from '@/stores/stats-store';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';

export function CategoryLabel({ categoryId, size = 'md' }: { categoryId: string; size?: 'sm' | 'md' }) {
  const category = useCategory(categoryId);
  const box = size === 'sm' ? 26 : 34;
  return (
    <View className="flex-shrink flex-row items-center gap-2">
      <View
        style={{ width: box, height: box, borderRadius: box / 3, backgroundColor: withAlpha(category.color, 0.18) }}
        className="items-center justify-center"
      >
        <Icon name={category.icon} size={size === 'sm' ? 14 : 18} color={category.color} />
      </View>
      <AppText variant="caption" numberOfLines={1} style={{ color: category.color, flexShrink: 1 }}>
        {category.name}
      </AppText>
    </View>
  );
}

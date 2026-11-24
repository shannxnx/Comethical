import { View } from 'react-native';

import type { SwipeDirection } from '@/core';
import { Button } from '../ui/Button';

/** Button alternative to swiping. Left button = Ethical, right button = Unethical (matches swipe directions). */
export function AnswerButtons({ disabled, onAnswer }: { disabled: boolean; onAnswer: (direction: SwipeDirection) => void }) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <Button
          label="Ethical"
          icon="checkmark-circle"
          variant="ethical"
          size="lg"
          disabled={disabled}
          accessibilityHint="Answer that the action is ethical. Same as swiping left."
          onPress={() => onAnswer('left')}
        />
      </View>
      <View className="flex-1">
        <Button
          label="Unethical"
          icon="close-circle"
          variant="unethical"
          size="lg"
          disabled={disabled}
          accessibilityHint="Answer that the action is unethical. Same as swiping right."
          onPress={() => onAnswer('right')}
        />
      </View>
    </View>
  );
}

import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export function usePriceFlash(price: number, positive: boolean) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const prevPrice = useRef(price);

  useEffect(() => {
    if (price !== prevPrice.current) {
      prevPrice.current = price;
      flashAnim.setValue(1);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [price]);

  return flashAnim;
}

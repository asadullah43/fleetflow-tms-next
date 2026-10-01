'use client';

import { Center, Image } from '@mantine/core';
import { Icon } from './icons';

/** The company logo in a rounded tile, or the built-in truck mark when no logo is uploaded. */
export function BrandMark({ logoUrl, companyName, size = 32 }: { logoUrl: string | null; companyName: string; size?: number }) {
  if (logoUrl) {
    return <Image src={logoUrl} alt={companyName} w={size} h={size} fit="contain" radius="md" bg="white" style={{ flexShrink: 0 }} />;
  }
  return (
    <Center w={size} h={size} bg="brand.6" c="white" style={{ borderRadius: 9, flexShrink: 0 }}>
      <Icon.truck size={Math.round(size / 2)} />
    </Center>
  );
}

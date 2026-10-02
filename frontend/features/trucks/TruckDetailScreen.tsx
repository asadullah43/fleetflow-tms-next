'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Anchor, Box, Button, Center, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { AppShell } from '../../components/AppShell';
import { AsyncSelect } from '../../components/AsyncSelect';
import { useConfirmDanger } from '../../components/confirm';
import { FormActions } from '../../components/FormActions';
import { Icon } from '../../components/icons';
import { StatusBadge } from '../../components/StatusBadge';
import type { AssignmentDto } from '../../lib/api/assignments.api';
import { formatDate } from '../../lib/date';
import { useLanguage, useLocalizedDigits, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { rail } from '../../theme/theme';
import { AssignmentTimeline } from '../assignments/AssignmentTimeline';
import { lookups } from '../crud/lookups';
import { useTruckDetailViewModel } from './use-truck-detail-view-model';

type Form = { driverId: string; startDate: string; endDate: string };

function AssignmentFields({ form, onChange }: { form: Form; onChange: (form: Form) => void }) {
  const t = useT();
  const date = (name: 'startDate' | 'endDate', label: string, required: boolean) => (
    <DateInput label={t(label)} required={required} clearable={!required} value={form[name] || null} onChange={(value) => onChange({ ...form, [name]: value ?? '' })} valueFormat="YYYY-MM-DD" placeholder="YYYY-MM-DD" popoverProps={{ withinPortal: true }} />
  );
  return (
    <>
      <AsyncSelect label={t('Driver')} required lookup={lookups.drivers} value={form.driverId} onChange={(driverId) => onChange({ ...form, driverId })} />
      {date('startDate', 'Start date', true)}
      {date('endDate', 'End date (leave blank if ongoing)', false)}
    </>
  );
}

function HeroStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text size="xs" fw={600} c="rgba(255,255,255,0.6)" mb={4}>
        {label}
      </Text>
      <Text component="div" fw={700}>
        {children}
      </Text>
    </Box>
  );
}

function InfoTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box bg="sand.0" p="sm" style={{ borderRadius: 10 }}>
      <Text size="xs" c="dimmed" fw={600} mb={4}>
        {label}
      </Text>
      <Text component="div" fw={700} size="sm">
        {children}
      </Text>
    </Box>
  );
}

function TruckDetailBody({ truckId }: { truckId: number }) {
  const vm = useTruckDetailViewModel(truckId);
  const t = useT();
  const n = useLocalizedDigits();
  const { language } = useLanguage();
  const confirmDanger = useConfirmDanger();
  const driverName = (assignment: AssignmentDto) => localizedJoinedName(assignment.driverName, assignment.driverNameAr, language) ?? `#${assignment.driverId}`;

  const back = (
    <Anchor component={Link} href="/trucks" size="sm" c="dimmed" mb="md" display="inline-block">
      {t('← Back to Trucks')}
    </Anchor>
  );

  if (vm.error) {
    return (
      <>
        {back}
        <Alert color="red">{t(vm.error)}</Alert>
      </>
    );
  }
  if (vm.loading || !vm.truck) {
    return (
      <Center py={80}>
        <Loader aria-label={t('Loading...')} />
      </Center>
    );
  }
  const { truck } = vm;

  const confirmRemove = (assignment: AssignmentDto) =>
    confirmDanger({ title: `${t('Remove this assignment for')} ${driverName(assignment)}?`, confirmLabel: 'Remove', onConfirm: () => void vm.remove(assignment) });

  return (
    <>
      {back}
      <Stack gap="md">
        <Paper p="xl" withBorder={false} c="white" style={{ background: `linear-gradient(135deg, ${rail.bg} 0%, ${rail.raised} 55%, ${rail.active} 100%)` }}>
          <Group justify="space-between" gap="xl">
            <Group gap="md" wrap="nowrap">
              <Center w={52} h={52} bg="rgba(255,255,255,0.08)" style={{ borderRadius: 14 }}>
                <Icon.truck size={26} />
              </Center>
              <Box>
                <Title order={2} fz={22} ff="monospace">
                  {truck.truckNumber}
                </Title>
                {truck.truckType && (
                  <Text size="sm" c="rgba(255,255,255,0.65)">
                    {truck.truckType}
                  </Text>
                )}
              </Box>
            </Group>
            <Group gap="xl">
              <HeroStat label={t('Current driver')}>{vm.current ? driverName(vm.current) : t('Unassigned')}</HeroStat>
              <HeroStat label={t('Assignment history')}>{n(vm.history.length)}</HeroStat>
              <HeroStat label={t('Status')}>
                <StatusBadge status={truck.status} />
              </HeroStat>
            </Group>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Stack gap="md">
            {vm.current ? (
              <Paper p="lg" style={{ borderColor: 'var(--mantine-color-teal-5)' }}>
                <Group gap="md" wrap="nowrap">
                  <ThemeIcon color="teal.8" size={44} radius="md">
                    <Icon.driver size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={700}>{driverName(vm.current)}</Text>
                    <Text size="xs" c="dimmed">
                      {t('Current since')} {formatDate(vm.current.startDate)}
                      {!vm.current.endDate && <> · {t('Ongoing')}</>}
                    </Text>
                  </Box>
                </Group>
              </Paper>
            ) : (
              <Paper p="lg">
                <Text size="sm" c="dimmed" ta="center">
                  {t('No driver currently assigned.')}
                </Text>
              </Paper>
            )}

            {vm.canAssign && (
              <Paper p="lg">
                <Title order={3} fz="md">
                  {t('Assign a driver')}
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  {t('Start a new assignment for this truck.')}
                </Text>
                <Stack gap="sm">
                  {vm.formError && <Alert color="red">{t(vm.formError)}</Alert>}
                  <AssignmentFields form={vm.form} onChange={vm.setForm} />
                  <Button fullWidth loading={vm.assigning} disabled={!vm.form.driverId || !vm.form.startDate} onClick={() => void vm.assign()}>
                    {t('Assign driver')}
                  </Button>
                </Stack>
              </Paper>
            )}
          </Stack>

          <Paper p="lg">
            <Title order={3} fz="md">
              {t('Assignment history')}
            </Title>
            <Text size="sm" c="dimmed" mb="md">
              {t('Every driver this truck has been assigned to, most recent first.')}
            </Text>
            <AssignmentTimeline
              history={vm.history}
              actions={
                vm.canEdit || vm.canRemove
                  ? (assignment) => (
                      <ActionMenu
                        items={[
                          actions.edit(() => vm.openEdit(assignment), { hidden: !vm.canEdit }),
                          actions.remove(() => confirmRemove(assignment), { hidden: !vm.canRemove }),
                        ]}
                      />
                    )
                  : undefined
              }
            />
          </Paper>
        </SimpleGrid>

        <Paper p="lg">
          <Title order={3} fz="md" mb="md">
            {t('Truck details')}
          </Title>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
            <InfoTile label={t('Truck number')}>{truck.truckNumber}</InfoTile>
            <InfoTile label={t('Type')}>{truck.truckType || '—'}</InfoTile>
            <InfoTile label={t('Status')}>
              <StatusBadge status={truck.status} />
            </InfoTile>
            <InfoTile label={t('Assignment history')}>{n(vm.history.length)}</InfoTile>
          </SimpleGrid>
        </Paper>
      </Stack>

      <Modal opened={vm.editing !== null} onClose={vm.closeEdit} title={t('Edit assignment')} closeOnClickOutside={false}>
        <Stack gap="sm">
          {vm.editError && <Alert color="red">{t(vm.editError)}</Alert>}
          <AssignmentFields form={vm.editForm} onChange={vm.setEditForm} />
          <Box mt="sm">
            <FormActions onCancel={vm.closeEdit} saving={vm.savingEdit} disabled={!vm.editForm.driverId || !vm.editForm.startDate} onSubmit={() => void vm.saveEdit()} />
          </Box>
        </Stack>
      </Modal>
    </>
  );
}

export function TruckDetailScreen() {
  const params = useParams<{ id: string }>();
  return (
    <AppShell title="Truck">
      <TruckDetailBody truckId={Number(params.id)} />
    </AppShell>
  );
}

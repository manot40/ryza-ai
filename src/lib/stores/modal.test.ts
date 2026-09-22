import { describe, expect, it, vi } from 'vitest';
import { ModalStore } from './modal.svelte';

describe('ModalStore', () => {
  it('opens modal with options', () => {
    const m = new ModalStore();
    m.openModal({
      title: 'Warning',
      body: 'Are you sure?',
      okText: 'Yes',
      cancelText: 'No',
    });

    expect(m.isOpen).toBe(true);
    expect(m.title).toBe('Warning');
    expect(m.body).toBe('Are you sure?');
    expect(m.okText).toBe('Yes');
    expect(m.cancelText).toBe('No');
  });

  it('handles Ok and calls onOk callback', async () => {
    const m = new ModalStore();
    const onOk = vi.fn();
    m.openModal({
      title: 'Confirm',
      onOk,
    });

    await m.handleOk();
    expect(m.isOpen).toBe(false);
    expect(onOk).toHaveBeenCalledTimes(1);
  });

  it('handles Cancel and calls onCancel callback', () => {
    const m = new ModalStore();
    const onCancel = vi.fn();
    m.openModal({
      title: 'Confirm',
      onCancel,
    });

    m.handleCancel();
    expect(m.isOpen).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirm helper returns true on Ok and false on Cancel', async () => {
    const m = new ModalStore();

    const p1 = m.confirm('Proceed?');
    expect(m.isOpen).toBe(true);
    await m.handleOk();
    const res1 = await p1;
    expect(res1).toBe(true);

    const p2 = m.confirm('Proceed again?');
    m.handleCancel();
    const res2 = await p2;
    expect(res2).toBe(false);
  });

  it('alert helper returns resolved promise on Ok', async () => {
    const m = new ModalStore();
    const p = m.alert('Notice', 'Done!');
    expect(m.cancelText).toBeNull();
    await m.handleOk();
    await expect(p).resolves.toBeUndefined();
  });
});

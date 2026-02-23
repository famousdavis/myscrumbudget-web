import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseDialog, ConfirmDialog, AlertDialog, dialogButtonStyles } from '../BaseDialog';

describe('BaseDialog', () => {
  it('renders title and children', () => {
    render(
      <BaseDialog title="Test Title" actions={<button>OK</button>}>
        <p>Body content</p>
      </BaseDialog>,
    );
    expect(screen.getByText('Test Title')).toBeDefined();
    expect(screen.getByText('Body content')).toBeDefined();
  });

  it('renders action buttons', () => {
    render(
      <BaseDialog title="T" actions={<button>Save</button>}>
        <p>Body</p>
      </BaseDialog>,
    );
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('has dialog role and aria-modal', () => {
    render(
      <BaseDialog title="T" actions={null}>
        <p>Body</p>
      </BaseDialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('has aria-labelledby linking to title', () => {
    render(
      <BaseDialog title="Linked Title" actions={null}>
        <p>Body</p>
      </BaseDialog>,
    );
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = screen.getByText('Linked Title');
    expect(heading.id).toBe(labelledBy);
  });
});

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(
      <ConfirmDialog
        title="Delete Item"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Delete Item')).toBeDefined();
    expect(screen.getByText('Are you sure?')).toBeDefined();
  });

  it('renders default Delete confirm label', () => {
    render(
      <ConfirmDialog
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('renders custom confirm label', () => {
    render(
      <ConfirmDialog
        title="T"
        message="M"
        confirmLabel="Remove"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Remove')).toBeDefined();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="T"
        message="M"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders JSX message content', () => {
    render(
      <ConfirmDialog
        title="T"
        message={<>Delete <strong>MyProject</strong>?</>}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('MyProject')).toBeDefined();
  });
});

describe('AlertDialog', () => {
  it('renders title and message', () => {
    render(
      <AlertDialog
        title="Notice"
        message="Something happened"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Notice')).toBeDefined();
    expect(screen.getByText('Something happened')).toBeDefined();
  });

  it('renders default OK button label', () => {
    render(
      <AlertDialog title="T" message="M" onClose={() => {}} />,
    );
    expect(screen.getByText('OK')).toBeDefined();
  });

  it('renders custom button label', () => {
    render(
      <AlertDialog
        title="T"
        message="M"
        buttonLabel="Got it"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Got it')).toBeDefined();
  });

  it('calls onClose when button clicked', () => {
    const onClose = vi.fn();
    render(
      <AlertDialog title="T" message="M" onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('dialogButtonStyles', () => {
  it('exports cancel, danger, and primary styles', () => {
    expect(dialogButtonStyles.cancel).toContain('border');
    expect(dialogButtonStyles.danger).toContain('bg-red');
    expect(dialogButtonStyles.primary).toContain('bg-blue');
  });
});

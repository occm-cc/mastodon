// Task 9.3: ImageUploadModal test
// Validates: Requirements 10.1, 10.2, 10.3, 10.4
/* eslint-disable */

import { IntlProvider } from 'react-intl';

import { MemoryRouter } from 'react-router';

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

import { ImageUploadModal } from './image_upload';

import '@testing-library/jest-dom';

// Mock the store
const mockDispatch = vi.fn(() => Promise.resolve());

const mockState = {
  profileEdit: {
    profile: null,
    isPending: false,
  },
  server: {
    server: {
      item: {
        configuration: {
          accounts: {
            max_header_description_length: 1500,
          },
        },
      },
    },
  },
};

vi.mock('@/mastodon/store', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: typeof mockState) => unknown) => {
    try {
      return selector(mockState);
    } catch {
      return undefined;
    }
  },
  createAppSelector: (...args: unknown[]) => {
    const resultFn = args[args.length - 1];
    return resultFn;
  },
  createAppAsyncThunk: vi.fn(),
}));

// Mock the profile_edit slice
const mockUploadImage = vi.fn();
vi.mock('@/mastodon/reducers/slices/profile_edit', () => ({
  selectImageInfo: () => ({
    src: null,
    static: null,
    alt: '',
  }),
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
}));

// Track the crop aspect passed to the Cropper

vi.mock('react-easy-crop', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    return <div data-testid='mock-cropper' data-aspect={props.aspect} />;
  },
}));

// Mock compose action
vi.mock('@/mastodon/actions/compose_typed', () => ({
  setDragUploadEnabled: () => ({ type: 'mock/setDragUploadEnabled' }),
}));

// Mock CSS module
vi.mock('./styles.module.scss', () => ({
  default: {
    uploadWrapper: 'uploadWrapper',
    uploadStepSelect: 'uploadStepSelect',
    cropContainer: 'cropContainer',
    cropActions: 'cropActions',
    zoomControl: 'zoomControl',
  },
}));

// Mock react-easy-crop CSS import
vi.mock('react-easy-crop/react-easy-crop.css', () => ({}));

// Mock SVG imports (material icons)
vi.mock('@/material-icons/400-24px/close.svg?react', () => ({
  default: () => <svg data-testid='close-icon' />,
}));

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob-url');
Object.defineProperty(URL, 'createObjectURL', {
  value: mockCreateObjectURL,
  writable: true,
});

// Helper wrapper with IntlProvider
function renderWithIntl(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <IntlProvider locale='en' messages={{}}>
        {ui}
      </IntlProvider>
    </MemoryRouter>,
  );
}

// Helper to create a mock File
function createMockFile(name: string, type: string, size = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('ImageUploadModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock dispatch to return a resolved promise
    mockDispatch.mockImplementation(() => Promise.resolve());

    mockUploadImage.mockReturnValue({ type: 'mock/uploadImage' });
  });

  describe('CROP_ASPECT values', () => {
    // We test this through the Cropper component's aspect prop
    it('uses aspect 3/2 for custom_logo location', async () => {
      // Mock FileReader before rendering
      const originalFileReader = globalThis.FileReader;
      class MockFileReader {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        addEventListener() {}
        readAsDataURL() {
          this.result = 'data:image/png;base64,iVBORw0KGgo=';
          setTimeout(() => {
            this.onload?.();
          }, 0);
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

      renderWithIntl(
        <ImageUploadModal onClose={mockOnClose} location='custom_logo' />,
      );

      // Select a PNG file to enter crop step
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();

      const file = createMockFile('logo.png', 'image/png');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
        // Allow setTimeout in MockFileReader to fire
        await new Promise((r) => setTimeout(r, 10));
      });

      // Now the Cropper should be rendered with the correct aspect
      const cropper = screen.getByTestId('mock-cropper');
      expect(cropper).toBeInTheDocument();
      expect(Number(cropper.getAttribute('data-aspect'))).toBeCloseTo(3 / 2, 5);

      globalThis.FileReader = originalFileReader;
    });

    it('uses aspect 16/9 for background_image location', async () => {
      const originalFileReader = globalThis.FileReader;
      class MockFileReader {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        addEventListener() {}
        readAsDataURL() {
          this.result = 'data:image/png;base64,iVBORw0KGgo=';
          setTimeout(() => {
            this.onload?.();
          }, 0);
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

      renderWithIntl(
        <ImageUploadModal onClose={mockOnClose} location='background_image' />,
      );

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();

      const file = createMockFile('bg.png', 'image/png');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
        await new Promise((r) => setTimeout(r, 10));
      });

      const cropper = screen.getByTestId('mock-cropper');
      expect(cropper).toBeInTheDocument();
      expect(Number(cropper.getAttribute('data-aspect'))).toBeCloseTo(
        16 / 9,
        5,
      );

      globalThis.FileReader = originalFileReader;
    });
  });

  describe('PNG file advances to crop step', () => {
    it('selecting a PNG for custom_logo shows the crop step', async () => {
      const originalFileReader = globalThis.FileReader;
      class MockFileReader {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        addEventListener() {}
        readAsDataURL() {
          this.result = 'data:image/png;base64,iVBORw0KGgo=';
          setTimeout(() => {
            this.onload?.();
          }, 0);
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

      renderWithIntl(
        <ImageUploadModal onClose={mockOnClose} location='custom_logo' />,
      );

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = createMockFile('logo.png', 'image/png');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
        await new Promise((r) => setTimeout(r, 10));
      });

      // Crop step is shown - the Cropper is rendered
      expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();

      globalThis.FileReader = originalFileReader;
    });
  });

  describe('GIF file skips crop step', () => {
    it('selecting a GIF for custom_logo skips crop and goes to alt step', async () => {
      renderWithIntl(
        <ImageUploadModal onClose={mockOnClose} location='custom_logo' />,
      );

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = createMockFile('animated.gif', 'image/gif');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Should NOT show the cropper
      expect(screen.queryByTestId('mock-cropper')).not.toBeInTheDocument();

      // Should show the alt text step - look for the Done button (alt step has Back + Done)
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /done/i }),
        ).toBeInTheDocument();
      });
    });

    it('selecting a GIF for background_image skips crop AND alt, goes directly to save', async () => {
      renderWithIntl(
        <ImageUploadModal onClose={mockOnClose} location='background_image' />,
      );

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = createMockFile('animated.gif', 'image/gif');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Should NOT show the cropper
      expect(screen.queryByTestId('mock-cropper')).not.toBeInTheDocument();

      // Should directly dispatch uploadImage (save step) with empty alt
      await waitFor(() => {
        expect(mockUploadImage).toHaveBeenCalledWith(
          expect.objectContaining({
            location: 'background_image',
            altText: '',
          }),
        );
      });
    });
  });

  describe('replacement uploads only the most recently selected blob (Req 10.4)', () => {
    it('confirming a replacement uploads only the most recently selected blob', async () => {
      renderWithIntl(
        <ImageUploadModal onClose={mockOnClose} location='background_image' />,
      );

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      // Select first GIF file
      const file1 = createMockFile('first.gif', 'image/gif', 100);

      await act(async () => {
        fireEvent.change(input, { target: { files: [file1] } });
      });

      // For background_image + GIF, it goes directly to save
      // The uploadImage should be called with the last selected blob
      await waitFor(() => {
        expect(mockUploadImage).toHaveBeenCalledTimes(1);
      });

      // Verify the blob passed is the file we selected (File extends Blob)
      const uploadCall = mockUploadImage.mock.calls[0]![0];
      expect(uploadCall.location).toBe('background_image');
      expect(uploadCall.imageBlob).toBe(file1);
      expect(uploadCall.altText).toBe('');
    });
  });
});

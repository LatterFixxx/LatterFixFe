import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a gravatar URL built from the email MD5 hash', () => {
    render(<Avatar email="test@example.com" name="Test User" />);
    const img = screen.getByAltText('Test User') as HTMLImageElement;
    // MD5 of "test@example.com" is 55502f40dc8b7c769880b10874abc9d0
    expect(img.src).toContain(
      'https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0'
    );
    expect(img.src).toContain('?d=identicon');
  });

  it('prefers the custom imageUrl over gravatar', () => {
    render(
      <Avatar
        email="test@example.com"
        name="Test User"
        imageUrl="https://cdn.example.com/avatar.png"
      />
    );
    const img = screen.getByAltText('Test User') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.example.com/avatar.png');
  });

  it('shows initials as fallback when the image fails to load', () => {
    render(<Avatar email="test@example.com" name="Jane Doe" />);
    const img = screen.getByAltText('Jane Doe') as HTMLImageElement;
    fireEvent.error(img);
    // initials span with "JD" should now be visible
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('shows single initial when name is a single word', () => {
    render(<Avatar email="bob@example.com" name="Bob" />);
    const img = screen.getByAltText('Bob') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('applies size classes for sm, md, lg', () => {
    const { rerender } = render(<Avatar email="a@b.c" name="A B" size="sm" />);
    const smDiv = screen.getByTitle('A B');
    expect(smDiv.className).toContain('w-7 h-7');

    rerender(<Avatar email="a@b.c" name="A B" size="md" />);
    const mdDiv = screen.getByTitle('A B');
    expect(mdDiv.className).toContain('w-10 h-10');

    rerender(<Avatar email="a@b.c" name="A B" size="lg" />);
    const lgDiv = screen.getByTitle('A B');
    expect(lgDiv.className).toContain('w-16 h-16');
  });

  it('trims and lowercases the email before hashing', () => {
    render(<Avatar email="  TEST@EXAMPLE.COM  " name="Test User" />);
    const img = screen.getByAltText('Test User') as HTMLImageElement;
    expect(img.src).toContain('55502f40dc8b7c769880b10874abc9d0');
  });

  it('resets error state when the image source changes', () => {
    const { rerender } = render(
      <Avatar email="a@b.c" name="A B" imageUrl="https://bad.example/x.png" />
    );
    const img = screen.getByAltText('A B') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByText('AB')).toBeTruthy();

    // Changing source (e.g. a newly uploaded avatar) resets the failed state
    rerender(<Avatar email="a@b.c" name="A B" imageUrl="https://ok.example/new.png" />);
    const img2 = screen.getByAltText('A B') as HTMLImageElement;
    expect(img2).toBeTruthy();
    // The new image is rendered again (img present)
    expect(img2.src).toBe('https://ok.example/new.png');
  });

  it('uses the user initial "U" when fallback initials are empty', () => {
    render(<Avatar email="x@y.z" name="" />);
    const img = screen.getByAltText('') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByText('U')).toBeTruthy();
  });
});
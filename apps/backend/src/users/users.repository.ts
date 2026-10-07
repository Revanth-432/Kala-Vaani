import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, Profile, UserRole } from '@artisan/database';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by ID including their profile relation
   */
  async findById(id: string): Promise<(User & { profile: Profile | null }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Ensure user row exists matching the Supabase Auth UUID (Just-In-Time provisioning)
   */
  async ensureUserExists(
    id: string,
    email?: string,
    phone?: string,
    roles: UserRole[] = [UserRole.ARTISAN],
  ): Promise<User> {
    // Supabase returns "" for users without a phone/email; both columns are unique,
    // so blank values (or a phone already owned by another user) must not be written.
    const safeEmail: string | undefined = email?.trim() || undefined;
    let safePhone: string | undefined = phone?.trim() || undefined;
    if (safePhone) {
      const owner = await this.prisma.user.findUnique({
        where: { phone: safePhone },
        select: { id: true },
      });
      if (owner && owner.id !== id) {
        safePhone = undefined;
      }
    }

    return this.prisma.user.upsert({
      where: { id },
      update: {
        ...(safeEmail ? { email: safeEmail } : {}),
        ...(safePhone ? { phone: safePhone } : {}),
      },
      create: {
        id,
        email: safeEmail ?? null,
        phone: safePhone ?? null,
        roles,
        isActive: true,
      },
    });
  }

  /**
   * Find profile by user ID
   */
  async findProfileByUserId(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({
      where: { userId },
    });
  }

  /**
   * Create a new artisan profile linked to a user
   */
  async createProfile(userId: string, data: CreateProfileDto): Promise<Profile> {
    return this.prisma.profile.create({
      data: {
        userId,
        fullName: data.fullName,
        businessName: data.businessName,
        craftType: data.craftType,
        region: data.region,
        state: data.state,
        preferredLanguage: data.preferredLanguage ?? 'en',
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        address: data.address,
      },
    });
  }

  /**
   * Update the phone on the user row (null clears it)
   */
  async updateUserPhone(userId: string, phone: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });
  }

  /**
   * Find the user that owns a phone number, if any
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  /**
   * Update an existing artisan profile
   */
  async updateProfile(userId: string, data: UpdateProfileDto): Promise<Profile> {
    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.businessName !== undefined ? { businessName: data.businessName } : {}),
        ...(data.craftType !== undefined ? { craftType: data.craftType } : {}),
        ...(data.region !== undefined ? { region: data.region } : {}),
        ...(data.state !== undefined ? { state: data.state } : {}),
        ...(data.preferredLanguage !== undefined ? { preferredLanguage: data.preferredLanguage } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
      },
    });
  }
}

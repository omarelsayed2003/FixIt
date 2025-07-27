from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="LebFix Service Marketplace API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    CUSTOMER = "customer"
    FREELANCE_FIXER = "freelance_fixer"
    EMPLOYEE_FIXER = "employee_fixer"
    COMPANY = "company"

class ServiceCategory(str, Enum):
    ELECTRICAL = "electrical"
    TECHNICAL = "technical"
    MECHANICAL = "mechanical"
    PLUMBING = "plumbing"

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    phone: Optional[str] = None
    picture: Optional[str] = None
    session_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Role-specific fields
    company_id: Optional[str] = None  # For employee_fixer
    address: Optional[str] = None
    working_hours: Optional[Dict[str, Any]] = None
    is_available: bool = True

class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_id: str
    email: EmailStr
    phone: str
    address: str
    description: Optional[str] = None
    service_categories: List[ServiceCategory] = []
    employees: List[str] = []  # List of employee user IDs
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ServiceProvider(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    company_id: Optional[str] = None  # None for freelancers
    service_categories: List[ServiceCategory] = []
    hourly_rate: Optional[float] = None  # For freelancers
    emergency_rate: Optional[float] = None
    description: Optional[str] = None
    rating: float = 0.0
    total_jobs: int = 0
    location: Optional[Dict[str, float]] = None  # {"lat": 0.0, "lng": 0.0}
    availability: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    provider_id: str
    company_id: Optional[str] = None
    service_category: ServiceCategory
    description: str
    scheduled_date: datetime
    status: BookingStatus = BookingStatus.PENDING
    price: Optional[float] = None
    location: Dict[str, Any]  # Address and coordinates
    emergency: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AuthRequest(BaseModel):
    host_url: str

class AuthResponse(BaseModel):
    auth_url: str

class SessionRequest(BaseModel):
    session_id: str

class BookingCreate(BaseModel):
    provider_id: str
    service_category: ServiceCategory
    description: str
    scheduled_date: datetime
    location: Dict[str, Any]
    emergency: bool = False

# Authentication helpers
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user = await db.users.find_one({"session_token": token})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    return User(**user)

# Auth endpoints
@api_router.post("/auth/login", response_model=AuthResponse)
async def initiate_auth(request: AuthRequest):
    """Initiate authentication with Emergent Auth"""
    auth_url = f"https://auth.emergentagent.com/?redirect={request.host_url}/auth/callback"
    return AuthResponse(auth_url=auth_url)

@api_router.post("/auth/session")
async def verify_session(request: SessionRequest):
    """Verify session with Emergent Auth and create/update user"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            user_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one({"email": user_data["email"]})
            
            if existing_user:
                # Update session token
                await db.users.update_one(
                    {"email": user_data["email"]},
                    {"$set": {"session_token": user_data["session_token"]}}
                )
                user = User(**existing_user)
                user.session_token = user_data["session_token"]
            else:
                # Create new user (will need role selection)
                user = User(
                    email=user_data["email"],
                    name=user_data["name"],
                    picture=user_data.get("picture"),
                    session_token=user_data["session_token"],
                    role=UserRole.CUSTOMER  # Default role
                )
                await db.users.insert_one(user.dict())
            
            return {"user": user.dict(), "is_new_user": existing_user is None}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/complete-profile")
async def complete_profile(
    role: UserRole,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Complete user profile after initial registration"""
    update_data = {
        "role": role,
        "phone": phone,
        "address": address
    }
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    # If role is company, create company record
    if role == UserRole.COMPANY:
        company = Company(
            name=f"{current_user.name}'s Company",
            owner_id=current_user.id,
            email=current_user.email,
            phone=phone or "",
            address=address or ""
        )
        await db.companies.insert_one(company.dict())
    
    # If role is freelance_fixer, create service provider record
    elif role == UserRole.FREELANCE_FIXER:
        provider = ServiceProvider(
            user_id=current_user.id,
            service_categories=[],
            hourly_rate=25.0,  # Default rate
            emergency_rate=50.0
        )
        await db.service_providers.insert_one(provider.dict())
    
    return {"message": "Profile completed successfully"}

# User endpoints
@api_router.get("/users/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

# Service provider endpoints
@api_router.get("/providers", response_model=List[Dict[str, Any]])
async def get_service_providers(
    category: Optional[ServiceCategory] = None,
    emergency: Optional[bool] = None
):
    """Get list of service providers"""
    query = {}
    if category:
        query["service_categories"] = category
    
    providers = await db.service_providers.find(query).to_list(100)
    
    # Enrich with user data
    enriched_providers = []
    for provider in providers:
        user = await db.users.find_one({"id": provider["user_id"]})
        company = None
        if provider.get("company_id"):
            company = await db.companies.find_one({"id": provider["company_id"]})
        
        enriched_provider = {
            **provider,
            "user": user,
            "company": company
        }
        enriched_providers.append(enriched_provider)
    
    return enriched_providers

@api_router.post("/providers/profile")
async def update_provider_profile(
    service_categories: List[ServiceCategory],
    hourly_rate: Optional[float] = None,
    emergency_rate: Optional[float] = None,
    description: Optional[str] = None,
    working_hours: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """Update service provider profile"""
    if current_user.role not in [UserRole.FREELANCE_FIXER, UserRole.EMPLOYEE_FIXER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    provider = await db.service_providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    update_data = {
        "service_categories": service_categories,
        "description": description,
        "availability": working_hours or {}
    }
    
    # Only freelancers can set their own rates
    if current_user.role == UserRole.FREELANCE_FIXER:
        if hourly_rate is not None:
            update_data["hourly_rate"] = hourly_rate
        if emergency_rate is not None:
            update_data["emergency_rate"] = emergency_rate
    
    await db.service_providers.update_one(
        {"user_id": current_user.id},
        {"$set": update_data}
    )
    
    return {"message": "Profile updated successfully"}

# Company endpoints
@api_router.get("/companies/my-company")
async def get_my_company(current_user: User = Depends(get_current_user)):
    """Get company details for company owner"""
    if current_user.role != UserRole.COMPANY:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    company = await db.companies.find_one({"owner_id": current_user.id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get employee details
    employees = []
    if company.get("employees"):
        employee_users = await db.users.find({"id": {"$in": company["employees"]}}).to_list(100)
        employees = employee_users
    
    return {
        **company,
        "employees": employees
    }

@api_router.post("/companies/add-employee")
async def add_employee(
    employee_email: EmailStr,
    hourly_rate: float,
    emergency_rate: float,
    service_categories: List[ServiceCategory],
    current_user: User = Depends(get_current_user)
):
    """Add employee to company"""
    if current_user.role != UserRole.COMPANY:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    company = await db.companies.find_one({"owner_id": current_user.id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Find employee user
    employee = await db.users.find_one({"email": employee_email})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Update employee role and company
    await db.users.update_one(
        {"id": employee["id"]},
        {"$set": {"role": UserRole.EMPLOYEE_FIXER, "company_id": company["id"]}}
    )
    
    # Create service provider profile for employee
    provider = ServiceProvider(
        user_id=employee["id"],
        company_id=company["id"],
        service_categories=service_categories,
        hourly_rate=hourly_rate,
        emergency_rate=emergency_rate
    )
    await db.service_providers.insert_one(provider.dict())
    
    # Add to company employees list
    await db.companies.update_one(
        {"id": company["id"]},
        {"$addToSet": {"employees": employee["id"]}}
    )
    
    return {"message": "Employee added successfully"}

# Booking endpoints
@api_router.post("/bookings", response_model=Dict[str, Any])
async def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new booking"""
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can create bookings")
    
    # Get provider details
    provider = await db.service_providers.find_one({"id": booking_data.provider_id})
    if not provider:
        raise HTTPException(status_code=404, detail="Service provider not found")
    
    # Calculate price based on provider type
    price = provider.get("hourly_rate", 25.0)
    if booking_data.emergency:
        price = provider.get("emergency_rate", 50.0)
    
    booking = Booking(
        customer_id=current_user.id,
        provider_id=booking_data.provider_id,
        company_id=provider.get("company_id"),
        service_category=booking_data.service_category,
        description=booking_data.description,
        scheduled_date=booking_data.scheduled_date,
        price=price,
        location=booking_data.location,
        emergency=booking_data.emergency
    )
    
    await db.bookings.insert_one(booking.dict())
    return booking.dict()

@api_router.get("/bookings")
async def get_bookings(current_user: User = Depends(get_current_user)):
    """Get bookings for current user"""
    query = {}
    
    if current_user.role == UserRole.CUSTOMER:
        query["customer_id"] = current_user.id
    elif current_user.role in [UserRole.FREELANCE_FIXER, UserRole.EMPLOYEE_FIXER]:
        provider = await db.service_providers.find_one({"user_id": current_user.id})
        if provider:
            query["provider_id"] = provider["id"]
    elif current_user.role == UserRole.COMPANY:
        company = await db.companies.find_one({"owner_id": current_user.id})
        if company:
            query["company_id"] = company["id"]
    
    bookings = await db.bookings.find(query).to_list(100)
    
    # Enrich with user and provider data
    enriched_bookings = []
    for booking in bookings:
        customer = await db.users.find_one({"id": booking["customer_id"]})
        provider_data = await db.service_providers.find_one({"id": booking["provider_id"]})
        provider_user = await db.users.find_one({"id": provider_data["user_id"]}) if provider_data else None
        
        enriched_booking = {
            **booking,
            "customer": customer,
            "provider": provider_data,
            "provider_user": provider_user
        }
        enriched_bookings.append(enriched_booking)
    
    return enriched_bookings

@api_router.put("/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    status: BookingStatus,
    current_user: User = Depends(get_current_user)
):
    """Update booking status"""
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check authorization
    if current_user.role == UserRole.CUSTOMER and booking["customer_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role in [UserRole.FREELANCE_FIXER, UserRole.EMPLOYEE_FIXER]:
        provider = await db.service_providers.find_one({"user_id": current_user.id})
        if not provider or booking["provider_id"] != provider["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Booking status updated successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
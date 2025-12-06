"use client";

import React, { useState, useRef } from "react";
import { Person, Marriage, createEmptyPerson, getFullName } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateId } from "@/lib/json-schema";
import { wouldCreateCycle } from "@/lib/cycles";
import { fileToDataUrl, isValidImageUrl, getInitials } from "@/lib/avatar";
import { useToast } from "@/hooks/use-toast";
import { ImageCropper } from "@/components/ImageCropper";
import { 
  UserPlus, Save, X, Upload, Link, User, Heart, 
  Calendar, MapPin, Briefcase, FileText, Baby, Skull,
  ChevronDown, ChevronUp, Users, Plus, Trash2
} from "lucide-react";

interface PersonFormProps {
  people: Person[];
  selectedPerson: Person | null;
  initialPerson?: Person; // For pre-filling new person data (like parent/child relationships)
  onAddPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => void;
  onCancelEdit: () => void;
  onAddRelative?: (type: "parent" | "child" | "spouse" | "sibling", relativeToId: string, spouseId?: string) => void;
  currentPersonId?: string;
  currentSpouseId?: string; // The spouse in the current couple context (for multi-spouse scenarios)
}

// Collapsible section component
function FormSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 font-medium text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

export function PersonForm({
  people,
  selectedPerson,
  initialPerson,
  onAddPerson,
  onUpdatePerson,
  onCancelEdit,
  onAddRelative,
  currentPersonId,
  currentSpouseId,
}: PersonFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Personal Details
  const [givenName, setGivenName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [occupation, setOccupation] = useState("");
  const [notes, setNotes] = useState("");
  
  // Birth Event
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  
  // Death Event
  const [isDeceased, setIsDeceased] = useState(false);
  const [deathDate, setDeathDate] = useState("");
  const [deathPlace, setDeathPlace] = useState("");
  
  // Relationships
  const [parent1Id, setParent1Id] = useState("");
  const [parent2Id, setParent2Id] = useState("");
  
  // Multiple Marriages Support
  interface MarriageFormData {
    spouseId: string;
    marriageDate: string;
    marriagePlace: string;
    isDivorced: boolean;
    divorceDate: string;
    divorcePlace: string;
  }
  const [marriages, setMarriages] = useState<MarriageFormData[]>([]);
  
  // Avatar
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarInputType, setAvatarInputType] = useState<"url" | "file">("url");
  
  // Image Cropper
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  
  // Full-size image viewer
  const [showFullImage, setShowFullImage] = useState(false);

  // Reset form when selectedPerson or initialPerson changes
  React.useEffect(() => {
    const personToLoad = selectedPerson || initialPerson;
    
    if (personToLoad) {
      setGivenName(personToLoad.givenName || "");
      setSurname(personToLoad.surname || "");
      setGender(personToLoad.gender || "");
      setOccupation(personToLoad.occupation || "");
      setNotes(personToLoad.notes || "");
      setBirthDate(personToLoad.birth?.date || "");
      setBirthPlace(personToLoad.birth?.place || "");
      setIsDeceased(!!personToLoad.death);
      setDeathDate(personToLoad.death?.date || "");
      setDeathPlace(personToLoad.death?.place || "");
      setParent1Id(personToLoad.parentIds[0] || "");
      setParent2Id(personToLoad.parentIds[1] || "");
      
      // Load all marriages
      if (personToLoad.marriages && personToLoad.marriages.length > 0) {
        setMarriages(personToLoad.marriages.map(m => ({
          spouseId: m.spouseId,
          marriageDate: m.date || "",
          marriagePlace: m.place || "",
          isDivorced: m.divorced || false,
          divorceDate: m.divorceDate || "",
          divorcePlace: m.divorcePlace || "",
        })));
      } else if (personToLoad.spouseIds.length > 0) {
        // Fallback: create marriage entries from spouseIds if no marriage data
        setMarriages(personToLoad.spouseIds.map(spouseId => ({
          spouseId,
          marriageDate: "",
          marriagePlace: "",
          isDivorced: false,
          divorceDate: "",
          divorcePlace: "",
        })));
      } else {
        setMarriages([]);
      }
      
      setAvatarUrl(personToLoad.avatarUrl || "");
    } else {
      resetForm();
    }
  }, [selectedPerson, initialPerson]);

  const resetForm = () => {
    setGivenName("");
    setSurname("");
    setGender("");
    setOccupation("");
    setNotes("");
    setBirthDate("");
    setBirthPlace("");
    setIsDeceased(false);
    setDeathDate("");
    setDeathPlace("");
    setParent1Id("");
    setParent2Id("");
    setMarriages([]);
    setAvatarUrl("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await fileToDataUrl(file);
        // Show cropper instead of directly setting avatar
        setCropImageSrc(dataUrl);
        setShowCropper(true);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to process image file",
          variant: "destructive",
        });
      }
    }
    // Reset input so same file can be selected again
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setAvatarUrl(croppedImageUrl);
    setShowCropper(false);
    setCropImageSrc("");
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCropImageSrc("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!givenName.trim() && !surname.trim()) {
      toast({
        title: "Error",
        description: "At least given name or surname is required",
        variant: "destructive",
      });
      return;
    }

    // Validate avatar URL if provided
    if (avatarUrl && !isValidImageUrl(avatarUrl)) {
      toast({
        title: "Error",
        description: "Invalid avatar URL",
        variant: "destructive",
      });
      return;
    }

    // Build parent IDs array
    const parentIds: string[] = [];
    if (parent1Id) parentIds.push(parent1Id);
    if (parent2Id && parent2Id !== parent1Id) parentIds.push(parent2Id);

    // Build spouse IDs array from marriages
    const spouseIds: string[] = marriages
      .filter(m => m.spouseId)
      .map(m => m.spouseId);

    const personId = selectedPerson?.id || initialPerson?.id || generateId();

    // Check for cycles
    for (const parentId of parentIds) {
      if (wouldCreateCycle(people, personId, parentId)) {
        toast({
          title: "Error",
          description: "This relationship would create a cycle in the family tree",
          variant: "destructive",
        });
        return;
      }
    }

    // Build marriages array for Person data
    const marriagesData: Marriage[] = marriages
      .filter(m => m.spouseId)
      .map(m => ({
        spouseId: m.spouseId,
        date: m.marriageDate,
        place: m.marriagePlace,
        divorced: m.isDivorced,
        divorceDate: m.isDivorced ? m.divorceDate : "",
        divorcePlace: m.isDivorced ? m.divorcePlace : "",
      }));

    const fullName = [givenName.trim(), surname.trim()].filter(Boolean).join(" ");

    const person: Person = {
      id: personId,
      name: fullName,
      givenName: givenName.trim(),
      surname: surname.trim(),
      gender,
      occupation: occupation.trim(),
      notes: notes.trim(),
      birth: {
        date: birthDate,
        place: birthPlace,
      },
      death: isDeceased ? {
        date: deathDate,
        place: deathPlace,
      } : null,
      parentIds,
      spouseIds,
      childIds: selectedPerson?.childIds || initialPerson?.childIds || [],
      marriages: marriagesData,
      avatarUrl: avatarUrl || null,
      position: selectedPerson?.position || initialPerson?.position || null,
    };

    if (selectedPerson) {
      onUpdatePerson(person);
      toast({
        title: "Success",
        description: `${fullName} has been updated`,
      });
    } else {
      onAddPerson(person);
      toast({
        title: "Success",
        description: `${fullName} has been added to the family tree`,
      });
      resetForm();
    }
  };

  // Filter out the current person from parent/spouse options
  const availableForParent = people.filter(
    (p) => p.id !== selectedPerson?.id && p.id !== parent2Id
  );
  const availableForParent2 = people.filter(
    (p) => p.id !== selectedPerson?.id && p.id !== parent1Id
  );
  const availableForSpouse = people.filter(
    (p) => p.id !== selectedPerson?.id
  );

  // Get parent names for display - use selectedPerson's actual parentIds
  const getParentNames = () => {
    if (!selectedPerson) return "None";
    const parentNames = selectedPerson.parentIds
      .map(pid => people.find(p => p.id === pid))
      .filter(Boolean)
      .map(p => getFullName(p!));
    return parentNames.length > 0 ? parentNames.join(" & ") : "None";
  };

  // Get sibling names for display - use selectedPerson's actual parentIds
  const getSiblingNames = () => {
    if (!selectedPerson) return "None";
    const parentIds = selectedPerson.parentIds;
    if (parentIds.length === 0) return "None";
    
    const siblings = people.filter(p => 
      p.id !== selectedPerson.id &&
      p.parentIds.some(pid => parentIds.includes(pid))
    );
    
    return siblings.length > 0 
      ? siblings.map(s => getFullName(s)).join(", ") 
      : "None";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Profile Image at Top Center */}
      <div className="flex flex-col items-center justify-center pb-2">
        <div className="relative group">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={givenName || "Profile"}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary shadow-lg cursor-pointer"
              onClick={() => setShowFullImage(true)}
            />
          ) : (
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ${
              gender === "male" ? "bg-sky-500" : 
              gender === "female" ? "bg-rose-400" : "bg-emerald-500"
            }`}>
              {getInitials(givenName ? `${givenName} ${surname}` : "?")}
            </div>
          )}
        </div>
        {givenName && (
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {givenName} {surname}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10">
        <h3 className="text-lg font-semibold text-primary">
          {selectedPerson ? "Edit Person" : "Add Person"}
        </h3>
        {selectedPerson && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancelEdit}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
          {/* Personal Details Section */}
          <FormSection title="Personal Details" icon={User} defaultOpen={true}>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="givenName" className="text-xs">Given Name *</Label>
                <Input
                  id="givenName"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  placeholder="First name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="surname" className="text-xs">Surname</Label>
                <Input
                  id="surname"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Last name"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="gender" className="text-xs">Gender</Label>
              <Select value={gender || "__none__"} onValueChange={(val) => setGender(val === "__none__" ? "" : val as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="occupation" className="text-xs">
                <Briefcase className="h-3 w-3 inline mr-1" />
                Occupation
              </Label>
              <Input
                id="occupation"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Job or profession"
                className="h-9"
              />
            </div>
          </FormSection>

          {/* Birth Event Section */}
          <FormSection title="Birth" icon={Baby} defaultOpen={true}>
            <div className="space-y-1">
              <Label htmlFor="birthDate" className="text-xs">
                <Calendar className="h-3 w-3 inline mr-1" />
                Date
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="birthPlace" className="text-xs">
                <MapPin className="h-3 w-3 inline mr-1" />
                Place
              </Label>
              <Input
                id="birthPlace"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="City, Country"
                className="h-9"
              />
            </div>
          </FormSection>

          {/* Death Event Section */}
          <FormSection title="Death" icon={Skull} defaultOpen={false}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="isDeceased"
                checked={isDeceased}
                onChange={(e) => setIsDeceased(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="isDeceased" className="text-xs cursor-pointer">
                Person is deceased
              </Label>
            </div>
            
            {isDeceased && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="deathDate" className="text-xs">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Date
                  </Label>
                  <Input
                    id="deathDate"
                    type="date"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="deathPlace" className="text-xs">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Place
                  </Label>
                  <Input
                    id="deathPlace"
                    value={deathPlace}
                    onChange={(e) => setDeathPlace(e.target.value)}
                    placeholder="City, Country"
                    className="h-9"
                  />
                </div>
              </>
            )}
          </FormSection>

          {/* Family Relationships Section - Display Only */}
          <FormSection title="Family Relationships" icon={User} defaultOpen={true}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parents:</span>
                <span className="font-medium">{getParentNames()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Siblings:</span>
                <span className="font-medium">{getSiblingNames()}</span>
              </div>
            </div>
          </FormSection>

          {/* Marriage Section - Multiple Spouses */}
          <FormSection title="Marriages" icon={Heart} defaultOpen={false}>
            {marriages.map((marriage, index) => {
              const spousePerson = people.find(p => p.id === marriage.spouseId);
              const availableSpouses = people.filter(
                p => p.id !== selectedPerson?.id && 
                     p.id !== initialPerson?.id &&
                     !marriages.some((m, i) => i !== index && m.spouseId === p.id)
              );
              
              return (
                <div key={index} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Marriage {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMarriages(marriages.filter((_, i) => i !== index));
                      }}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Spouse</Label>
                    <Select 
                      value={marriage.spouseId || "__none__"} 
                      onValueChange={(val) => {
                        const newMarriages = [...marriages];
                        newMarriages[index] = { ...newMarriages[index], spouseId: val === "__none__" ? "" : val };
                        setMarriages(newMarriages);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select spouse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {marriage.spouseId && spousePerson && (
                          <SelectItem value={marriage.spouseId}>
                            {getFullName(spousePerson)}
                          </SelectItem>
                        )}
                        {availableSpouses.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {getFullName(person)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {marriage.spouseId && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            Marriage Date
                          </Label>
                          <Input
                            type="date"
                            value={marriage.marriageDate}
                            onChange={(e) => {
                              const newMarriages = [...marriages];
                              newMarriages[index] = { ...newMarriages[index], marriageDate: e.target.value };
                              setMarriages(newMarriages);
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            Place
                          </Label>
                          <Input
                            value={marriage.marriagePlace}
                            onChange={(e) => {
                              const newMarriages = [...marriages];
                              newMarriages[index] = { ...newMarriages[index], marriagePlace: e.target.value };
                              setMarriages(newMarriages);
                            }}
                            placeholder="City, Country"
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`isDivorced-${index}`}
                          checked={marriage.isDivorced}
                          onChange={(e) => {
                            const newMarriages = [...marriages];
                            newMarriages[index] = { ...newMarriages[index], isDivorced: e.target.checked };
                            setMarriages(newMarriages);
                          }}
                          className="rounded border-input"
                        />
                        <Label htmlFor={`isDivorced-${index}`} className="text-xs cursor-pointer">
                          Divorced
                        </Label>
                      </div>

                      {marriage.isDivorced && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Divorce Date</Label>
                            <Input
                              type="date"
                              value={marriage.divorceDate}
                              onChange={(e) => {
                                const newMarriages = [...marriages];
                                newMarriages[index] = { ...newMarriages[index], divorceDate: e.target.value };
                                setMarriages(newMarriages);
                              }}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Divorce Place</Label>
                            <Input
                              value={marriage.divorcePlace}
                              onChange={(e) => {
                                const newMarriages = [...marriages];
                                newMarriages[index] = { ...newMarriages[index], divorcePlace: e.target.value };
                                setMarriages(newMarriages);
                              }}
                              placeholder="City, Country"
                              className="h-9"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMarriages([...marriages, {
                  spouseId: "",
                  marriageDate: "",
                  marriagePlace: "",
                  isDivorced: false,
                  divorceDate: "",
                  divorcePlace: "",
                }]);
              }}
              className="w-full h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Marriage
            </Button>
          </FormSection>

          {/* Notes Section */}
          <FormSection title="Notes" icon={FileText} defaultOpen={false}>
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs">Additional Notes</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information..."
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </FormSection>

          {/* Avatar Section */}
          <FormSection title="Photo" icon={User} defaultOpen={false}>
            <p className="text-xs text-muted-foreground mb-2">
              Tip: You can also hover over the profile image above to upload a photo.
            </p>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={avatarInputType === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setAvatarInputType("url")}
                className="h-8 text-xs"
              >
                <Link className="h-3 w-3 mr-1" />
                URL
              </Button>
              <Button
                type="button"
                variant={avatarInputType === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setAvatarInputType("file")}
                className="h-8 text-xs"
              >
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </div>
            
            {avatarInputType === "url" ? (
              <Input
                value={avatarUrl.startsWith("data:") ? "" : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Enter image URL"
                className="h-9"
              />
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3 mr-2" />
                  Choose Image
                </Button>
              </div>
            )}
            
            {avatarUrl && (
              <div className="flex items-center gap-2 mt-2">
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarUrl("")}
                  className="h-8 text-xs"
                >
                  Remove
                </Button>
              </div>
            )}
          </FormSection>
        </div>

      {/* Action buttons for adding relatives (only shown when editing) */}
      {selectedPerson && onAddRelative && currentPersonId && (
        <div className="border-t pt-4 mb-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Add Relative</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddRelative("parent", currentPersonId)}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Parent
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddRelative("child", currentPersonId, currentSpouseId)}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Child
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddRelative("spouse", currentPersonId)}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Spouse
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddRelative("sibling", currentPersonId)}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Sibling
            </Button>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full">
        {selectedPerson ? (
          <>
            <Save className="h-4 w-4 mr-2" />
            Update Person
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Person
          </>
        )}
      </Button>

      {/* Image Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Profile Photo</DialogTitle>
          </DialogHeader>
          {cropImageSrc && (
            <ImageCropper
              imageSrc={cropImageSrc}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
              aspectRatio={1}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Full-Size Image Viewer Dialog */}
      <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
        <DialogContent className="sm:max-w-2xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>View Photo</DialogTitle>
          </DialogHeader>
          {avatarUrl && (
            <div className="flex flex-col items-center">
              <img
                src={avatarUrl}
                alt={givenName || "Profile"}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
              {givenName && (
                <p className="mt-3 text-lg font-medium">
                  {givenName} {surname}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

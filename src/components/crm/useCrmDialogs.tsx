"use client";

import { useState } from "react";
import { ActivityDialog } from "@/components/crm/ActivityDialog";
import { ClientDialog } from "@/components/crm/ClientDialog";
import { ContactDialog } from "@/components/crm/ContactDialog";
import { NoteDialog } from "@/components/crm/NoteDialog";
import { OpportunityDialog } from "@/components/crm/OpportunityDialog";

type NoteContext = {
  clientId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  activityId?: string | null;
};

type DialogState = {
  open: boolean;
  id: string | null;
  mode: "create" | "view";
};

type NoteState = {
  open: boolean;
  id: string | null;
  context?: NoteContext;
  parentNoteId?: string | null;
  parentPreview?: string | null;
};

type UseCrmDialogsOptions = {
  onRefresh?: () => void;
};

export function useCrmDialogs(options: UseCrmDialogsOptions = {}) {
  const { onRefresh } = options;
  const [clientState, setClientState] = useState<DialogState>({ open: false, id: null, mode: "view" });
  const [contactState, setContactState] = useState<DialogState>({ open: false, id: null, mode: "view" });
  const [opportunityState, setOpportunityState] = useState<DialogState>({ open: false, id: null, mode: "view" });
  const [activityState, setActivityState] = useState<DialogState>({ open: false, id: null, mode: "view" });
  const [noteState, setNoteState] = useState<NoteState>({ open: false, id: null, context: undefined });

  const closeMainDialogs = () => {
    setClientState((prev) => ({ ...prev, open: false }));
    setContactState((prev) => ({ ...prev, open: false }));
    setOpportunityState((prev) => ({ ...prev, open: false }));
    setActivityState((prev) => ({ ...prev, open: false }));
  };

  const openClient = (id: string) => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setClientState({ open: true, id, mode: "view" });
  };

  const createClient = () => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setClientState({ open: true, id: null, mode: "create" });
  };

  const openContact = (id: string) => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setContactState({ open: true, id, mode: "view" });
  };

  const createContact = () => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setContactState({ open: true, id: null, mode: "create" });
  };

  const openOpportunity = (id: string) => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setOpportunityState({ open: true, id, mode: "view" });
  };

  const createOpportunity = () => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setOpportunityState({ open: true, id: null, mode: "create" });
  };

  const openActivity = (id: string) => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setActivityState({ open: true, id, mode: "view" });
  };

  const createActivity = () => {
    closeMainDialogs();
    setNoteState((prev) => ({ ...prev, open: false, id: null }));
    setActivityState({ open: true, id: null, mode: "create" });
  };

  const openNote = (id: string) => {
    setNoteState({ open: true, id, context: undefined });
  };

  const createNote = (context: NoteContext & { parentNoteId?: string; parentPreview?: string }) => {
    setNoteState({
      open: true,
      id: null,
      context,
      parentNoteId: context.parentNoteId || null,
      parentPreview: context.parentPreview || null,
    });
  };

  const dialogs = (
    <>
      <ClientDialog
        open={clientState.open}
        clientId={clientState.id}
        mode={clientState.mode}
        onClose={() => setClientState((prev) => ({ ...prev, open: false }))}
        onSaved={onRefresh}
        onOpenContact={openContact}
        onOpenOpportunity={openOpportunity}
        onOpenActivity={openActivity}
        onCreateOpportunity={createOpportunity}
        onCreateActivity={createActivity}
        onOpenNote={openNote}
        onCreateNote={createNote}
      />
      <ContactDialog
        open={contactState.open}
        contactId={contactState.id}
        mode={contactState.mode}
        onClose={() => setContactState((prev) => ({ ...prev, open: false }))}
        onSaved={onRefresh}
        onOpenClient={openClient}
        onOpenOpportunity={openOpportunity}
        onOpenActivity={openActivity}
        onCreateActivity={createActivity}
        onOpenNote={openNote}
        onCreateNote={createNote}
      />
      <OpportunityDialog
        open={opportunityState.open}
        opportunityId={opportunityState.id}
        mode={opportunityState.mode}
        onClose={() => setOpportunityState((prev) => ({ ...prev, open: false }))}
        onSaved={onRefresh}
        onOpenClient={openClient}
        onOpenContact={openContact}
        onOpenActivity={openActivity}
        onCreateActivity={createActivity}
        onOpenNote={openNote}
        onCreateNote={createNote}
      />
      <ActivityDialog
        open={activityState.open}
        activityId={activityState.id}
        mode={activityState.mode}
        onClose={() => setActivityState((prev) => ({ ...prev, open: false }))}
        onSaved={onRefresh}
        onOpenClient={openClient}
        onOpenOpportunity={openOpportunity}
        onOpenContact={openContact}
        onOpenNote={openNote}
        onCreateNote={createNote}
      />
      <NoteDialog
        open={noteState.open}
        noteId={noteState.id}
        context={noteState.context}
        parentNoteId={noteState.parentNoteId}
        parentPreview={noteState.parentPreview}
        onClose={() => setNoteState((prev) => ({ ...prev, open: false }))}
        onSaved={onRefresh}
      />
    </>
  );

  return {
    openClient,
    createClient,
    openContact,
    createContact,
    openOpportunity,
    createOpportunity,
    openActivity,
    createActivity,
    openNote,
    createNote,
    dialogs,
  };
}

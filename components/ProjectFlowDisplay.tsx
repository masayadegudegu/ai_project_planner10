Here's the fixed version with all missing closing brackets added:

```javascript
// ... [previous code remains the same until the end of the component's JSX]
    )}
    {isInviteModalOpen && currentProjectId && (
        <ProjectInviteModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            projectId={currentProjectId}
            projectTitle={projectGoal}
            members={projectMembers}
            userRole={userRole}
            onMembersUpdate={onMembersUpdate}
        />
    )}
    </>
  );
}

export default ProjectFlowDisplay;
```

